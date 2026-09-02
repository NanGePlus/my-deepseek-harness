/**
 * One language-server process with persistent editor documents and publishDiagnostics handling.
 * @module @deepseek-ai/dsh-lsp-stdio/editor-instance
 */

import { LspError } from '@deepseek-ai/dsh-lsp'
import type { LspEditorDiagnostic, LspEditorHover } from '@deepseek-ai/dsh-lsp-editor'
import type {
  LspEditorProviderCloseRequest,
  LspEditorProviderHoverRequest,
  LspEditorProviderSyncRequest,
} from '@deepseek-ai/dsh-lsp-editor'
import { deadline } from '@deepseek-ai/dsh-timeout'
import { abortable, abortError } from './abort.ts'
import { LspConnection } from './connection.ts'
import type { ConnectionSpawner, ConnectionSpec } from './connection.ts'
import { normalizePublishDiagnostics, readPublishDiagnosticsVersion, shouldApplyPublishedDiagnostics, shouldUpdateDiagnosticsCache } from './diagnostics.ts'
import { resolveHostSourceUri } from './host.ts'
import type { HostWorkspace } from './host.ts'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import type { WireInitializeResult } from './protocol.ts'
import { normalizeHover, negotiatePositionEncoding } from './translate.ts'

/** Everything an editor instance needs beyond the connection spec. */
export interface EditorInstanceSpec extends ConnectionSpec {
  readonly workspaceUri: string
  readonly initializationOptions: unknown
  readonly shutdownTimeoutMs: number
  readonly diagnosticsWaitMs: number
}

interface OpenDocument {
  readonly uri: string
  version: number
  text: string
  languageId: string
}

interface DiagnosticWaiter {
  expectedVersion: number
  resolve: (value: readonly LspEditorDiagnostic[]) => void
  reject: (error: Error) => void
}

/**
 * Persistent-open language server for Monaco diagnostics.
 */
/** Wait for publishDiagnostics to quiesce before resolving a sync waiter. */
export const DIAGNOSTICS_SETTLE_MS = 300

export class EditorLspInstance {
  private readonly connection: LspConnection
  private disposed = false
  private processClosed = false
  private readonly ready: Promise<void>
  private readonly openDocuments = new Map<string, OpenDocument>()
  private readonly diagnosticsByUri = new Map<string, readonly LspEditorDiagnostic[]>()
  private readonly diagnosticWaiters = new Map<string, DiagnosticWaiter[]>()
  private readonly diagnosticSettleTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly diagnosticSettleTokens = new Map<string, number>()
  private readonly lastPublishedVersionByUri = new Map<string, number | undefined>()

  constructor(
    private readonly spec: EditorInstanceSpec,
    private readonly fs: FileSystem,
    spawner: ConnectionSpawner,
  ) {
    this.connection = new LspConnection(
      spec,
      spawner,
      (method, params) => this.answerServerRequest(method, params),
      (method, params) => { this.handleNotification(method, params) },
    )
    this.ready = this.initialize()
    this.ready.catch(() => {})
    void this.connection.closed.then(() => { this.processClosed = true })
  }

  get dead(): boolean {
    return this.processClosed || this.disposed || this.connection.failed
  }

  async syncDocument(
    workspace: HostWorkspace,
    request: LspEditorProviderSyncRequest,
    signal?: AbortSignal,
  ): Promise<readonly LspEditorDiagnostic[]> {
    if (this.disposed) throw new LspError('LSP editor instance was disposed', 'LSP_DISPOSED')
    if (signal?.aborted) throw abortError(signal)
    await abortable(this.ready, signal)
    const uri = await resolveHostSourceUri(this.fs, request.filePath, workspace, signal)
    await this.ensureDocumentOpen(uri, request.languageId, request.version, request.text)
    return await this.waitForDiagnostics(uri, request.version, signal)
  }

  async closeDocument(
    workspace: HostWorkspace,
    request: LspEditorProviderCloseRequest,
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.disposed) return
    if (signal?.aborted) throw abortError(signal)
    await abortable(this.ready, signal)
    const uri = await resolveHostSourceUri(this.fs, request.filePath, workspace, signal)
    if (!this.openDocuments.has(uri)) return
    this.cancelDiagnosticSettle(uri)
    this.supersedeDiagnosticWaiters(uri)
    this.openDocuments.delete(uri)
    this.diagnosticsByUri.delete(uri)
    this.lastPublishedVersionByUri.delete(uri)
    try {
      await this.connection.notify('textDocument/didClose', { textDocument: { uri } })
    } catch {
      await this.dispose()
    }
  }

  async hoverDocument(
    workspace: HostWorkspace,
    request: LspEditorProviderHoverRequest,
    signal?: AbortSignal,
  ): Promise<LspEditorHover | null> {
    if (this.disposed) throw new LspError('LSP editor instance was disposed', 'LSP_DISPOSED')
    if (signal?.aborted) throw abortError(signal)
    await abortable(this.ready, signal)
    const uri = await resolveHostSourceUri(this.fs, request.filePath, workspace, signal)
    await this.ensureDocumentOpen(uri, request.languageId, request.version, request.text)
    const payload = await abortable(this.connection.request('textDocument/hover', {
      textDocument: { uri },
      position: {
        line: request.position.line,
        character: request.position.character,
      },
    }), signal)
    const hover = normalizeHover(payload)
    if (hover === null) return null
    return {
      contents: hover.contents,
      ...hover.range === undefined ? {} : { range: hover.range },
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    for (const uri of [...this.diagnosticSettleTimers.keys()]) {
      this.cancelDiagnosticSettle(uri)
    }
    for (const uri of [...this.diagnosticWaiters.keys()]) {
      this.supersedeDiagnosticWaiters(uri)
    }
    this.openDocuments.clear()
    this.diagnosticsByUri.clear()
    this.lastPublishedVersionByUri.clear()
    const shutdownDeadline = deadline(undefined, this.spec.shutdownTimeoutMs, 'LSP_EDITOR_SHUTDOWN')
    try {
      await abortable(this.connection.request('shutdown', null), shutdownDeadline.signal)
      await this.connection.notify('exit', null)
      await abortable(this.connection.closed, shutdownDeadline.signal)
    } catch {
      this.connection.terminate()
      await this.connection.closed
    } finally {
      shutdownDeadline[Symbol.dispose]()
    }
  }

  private async initialize(): Promise<void> {
    const initializeResult = await this.connection.request('initialize', {
      processId: null,
      rootUri: this.spec.workspaceUri,
      workspaceFolders: [{ uri: this.spec.workspaceUri, name: 'workspace' }],
      capabilities: EDITOR_CLIENT_CAPABILITIES,
      initializationOptions: this.spec.initializationOptions,
    }) as WireInitializeResult
    negotiatePositionEncoding(initializeResult.capabilities.positionEncoding)
    await this.connection.notify('initialized', {})
  }

  private handleNotification(method: string, params: unknown): void {
    if (method !== 'textDocument/publishDiagnostics') return
    if (params === null || typeof params !== 'object') return
    const uri = (params as { uri?: unknown }).uri
    if (typeof uri !== 'string') return
    this.publishDiagnostics(uri, params, normalizePublishDiagnostics(params))
  }

  private publishDiagnostics(
    uri: string,
    params: unknown,
    diagnostics: readonly LspEditorDiagnostic[],
  ): void {
    const publishedVersion = readPublishDiagnosticsVersion(params)
    const documentVersion = this.openDocuments.get(uri)?.version
    if (documentVersion !== undefined && !shouldUpdateDiagnosticsCache(publishedVersion, documentVersion)) {
      return
    }
    this.diagnosticsByUri.set(uri, diagnostics)
    this.scheduleDiagnosticSettle(uri, publishedVersion)
  }

  private scheduleDiagnosticSettle(uri: string, publishedVersion: number | undefined): void {
    if (this.diagnosticWaiters.get(uri) === undefined) return
    this.lastPublishedVersionByUri.set(uri, publishedVersion)
    const existing = this.diagnosticSettleTimers.get(uri)
    if (existing !== undefined) clearTimeout(existing)
    const token = (this.diagnosticSettleTokens.get(uri) ?? 0) + 1
    this.diagnosticSettleTokens.set(uri, token)
    this.diagnosticSettleTimers.set(uri, setTimeout(() => {
      this.diagnosticSettleTimers.delete(uri)
      if (this.diagnosticSettleTokens.get(uri) !== token) return
      this.flushDiagnosticWaiters(uri)
    }, DIAGNOSTICS_SETTLE_MS))
  }

  private flushDiagnosticWaiters(uri: string): void {
    const waiters = this.diagnosticWaiters.get(uri)
    if (waiters === undefined) return
    const publishedVersion = this.lastPublishedVersionByUri.get(uri)
    const diagnostics = this.diagnosticsByUri.get(uri) ?? []
    const remaining: DiagnosticWaiter[] = []
    for (const waiter of waiters) {
      if (shouldApplyPublishedDiagnostics(publishedVersion, waiter.expectedVersion)) {
        waiter.resolve(diagnostics)
      } else {
        remaining.push(waiter)
      }
    }
    if (remaining.length === 0) this.diagnosticWaiters.delete(uri)
    else this.diagnosticWaiters.set(uri, remaining)
  }

  private cancelDiagnosticSettle(uri: string): void {
    const timer = this.diagnosticSettleTimers.get(uri)
    if (timer !== undefined) clearTimeout(timer)
    this.diagnosticSettleTimers.delete(uri)
    this.diagnosticSettleTokens.set(uri, (this.diagnosticSettleTokens.get(uri) ?? 0) + 1)
  }

  private supersedeDiagnosticWaiters(uri: string): void {
    this.cancelDiagnosticSettle(uri)
    const waiters = this.diagnosticWaiters.get(uri)
    if (waiters === undefined) return
    this.diagnosticWaiters.delete(uri)
    for (const waiter of waiters) {
      waiter.reject(new LspError('LSP sync superseded by a newer edit', 'LSP_SUPERSEDED'))
    }
  }

  private async ensureDocumentOpen(
    uri: string,
    languageId: string,
    version: number,
    text: string,
  ): Promise<void> {
    const existing = this.openDocuments.get(uri)
    if (existing === undefined) {
      await this.connection.notify('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId,
          version,
          text,
        },
      })
      this.openDocuments.set(uri, {
        uri,
        version,
        text,
        languageId,
      })
      return
    }
    if (existing.text === text && existing.version === version) return
    this.cancelDiagnosticSettle(uri)
    this.supersedeDiagnosticWaiters(uri)
    this.diagnosticsByUri.delete(uri)
    this.lastPublishedVersionByUri.delete(uri)
    await this.connection.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    })
    existing.version = version
    existing.text = text
  }

  private waitForDiagnostics(
    uri: string,
    expectedVersion: number,
    signal?: AbortSignal,
  ): Promise<readonly LspEditorDiagnostic[]> {
    const wait = deadline(signal, this.spec.diagnosticsWaitMs, 'LSP_EDITOR_DIAGNOSTICS')
    return abortable(new Promise<readonly LspEditorDiagnostic[]>((resolve, reject) => {
      const waiter: DiagnosticWaiter = {
        expectedVersion,
        resolve: (value) => {
          this.removeDiagnosticWaiter(uri, waiter)
          resolve(value)
        },
        reject: (error) => {
          this.removeDiagnosticWaiter(uri, waiter)
          reject(error)
        },
      }
      const queue = this.diagnosticWaiters.get(uri) ?? []
      queue.push(waiter)
      this.diagnosticWaiters.set(uri, queue)
    }), wait.signal).finally(() => { wait[Symbol.dispose]() })
  }

  private removeDiagnosticWaiter(uri: string, target: DiagnosticWaiter): void {
    const queue = this.diagnosticWaiters.get(uri)
    if (queue === undefined) return
    const remaining = queue.filter(waiter => waiter !== target)
    if (remaining.length === 0) this.diagnosticWaiters.delete(uri)
    else this.diagnosticWaiters.set(uri, remaining)
  }

  private answerServerRequest(method: string, params: unknown): Promise<unknown> {
    if (method === 'workspace/configuration') {
      const record = params as { items?: unknown[] } | null
      const items = Array.isArray(record?.items) ? record.items : []
      return Promise.resolve(items.map(() => this.spec.configuration))
    }
    if (LIFECYCLE_NOOP_METHODS.has(method)) return Promise.resolve(null)
    if (method === 'workspace/applyEdit') {
      return Promise.reject(new Error('workspace/applyEdit is not permitted by this host'))
    }
    return Promise.reject(new Error(`unsupported server request: ${method}`))
  }
}

const LIFECYCLE_NOOP_METHODS = new Set([
  'window/workDoneProgress/create',
  'client/registerCapability',
  'client/unregisterCapability',
])

const EDITOR_CLIENT_CAPABILITIES = {
  general: { positionEncodings: ['utf-16'] },
  workspace: { workspaceFolders: true, configuration: true },
  textDocument: {
    synchronization: { dynamicRegistration: false, didSave: false },
    publishDiagnostics: { relatedInformation: false },
    hover: { contentFormat: ['markdown', 'plaintext'] },
  },
} as const
