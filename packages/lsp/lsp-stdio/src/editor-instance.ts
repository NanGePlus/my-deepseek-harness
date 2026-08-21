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
import { normalizePublishDiagnostics } from './diagnostics.ts'
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

/**
 * Persistent-open language server for Monaco diagnostics.
 */
export class EditorLspInstance {
  private readonly connection: LspConnection
  private disposed = false
  private processClosed = false
  private readonly ready: Promise<void>
  private readonly openDocuments = new Map<string, OpenDocument>()
  private readonly diagnosticsByUri = new Map<string, readonly LspEditorDiagnostic[]>()
  private readonly diagnosticWaiters = new Map<string, Array<(value: readonly LspEditorDiagnostic[]) => void>>()

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
    return await this.waitForDiagnostics(uri, signal)
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
    this.openDocuments.delete(uri)
    this.diagnosticsByUri.delete(uri)
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
    this.openDocuments.clear()
    this.diagnosticsByUri.clear()
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
    this.publishDiagnostics(uri, normalizePublishDiagnostics(params))
  }

  private publishDiagnostics(uri: string, diagnostics: readonly LspEditorDiagnostic[]): void {
    this.diagnosticsByUri.set(uri, diagnostics)
    const waiters = this.diagnosticWaiters.get(uri)
    if (waiters === undefined) return
    this.diagnosticWaiters.delete(uri)
    for (const resolve of waiters) resolve(diagnostics)
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
    await this.connection.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    })
    existing.version = version
    existing.text = text
  }

  private waitForDiagnostics(uri: string, signal?: AbortSignal): Promise<readonly LspEditorDiagnostic[]> {
    const wait = deadline(signal, this.spec.diagnosticsWaitMs, 'LSP_EDITOR_DIAGNOSTICS')
    return new Promise<readonly LspEditorDiagnostic[]>((resolve) => {
      const finish = (value: readonly LspEditorDiagnostic[]): void => {
        wait[Symbol.dispose]()
        resolve(value)
      }
      wait.signal.addEventListener('abort', () => {
        finish(this.diagnosticsByUri.get(uri) ?? [])
      }, { once: true })
      const queue = this.diagnosticWaiters.get(uri) ?? []
      queue.push(finish)
      this.diagnosticWaiters.set(uri, queue)
    })
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
