/**
 * Service Definition for the editor LSP capability seam (`ctx.lspEditor`): provider
 * registry and per-file persistent document sync that returns normalized diagnostics
 * for Monaco markers.
 * @module @deepseek-ai/dsh-lsp-editor
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { LspError, finalExtension } from '@deepseek-ai/dsh-lsp'
import type {
  LspEditorCloseRequest,
  LspEditorDiagnostic,
  LspEditorHover,
  LspEditorHoverRequest,
  LspEditorProvider,
  LspEditorService,
  LspEditorSyncRequest,
} from './types.ts'

export type {
  LspEditorCloseRequest,
  LspEditorDiagnostic,
  LspEditorDiagnosticSeverity,
  LspEditorHover,
  LspEditorHoverRequest,
  LspEditorProvider,
  LspEditorProviderCloseRequest,
  LspEditorProviderHoverRequest,
  LspEditorProviderSyncRequest,
  LspEditorService,
  LspEditorSyncRequest,
  LspPosition,
  LspRange,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Optional editor LSP seam; present when a host composition mounts an editor provider. */
    lspEditor: LspEditorService
  }
}

/** Re-export navigation seam errors for unified caller handling. */
export { LspError } from '@deepseek-ai/dsh-lsp'

const EXTENSION_PATTERN = /^\.[^./\\]+$/

interface Route {
  readonly provider: LspEditorProvider
  readonly languageId: string
}

/**
 * `ctx.lspEditor`. Routes sync/close requests by file extension the same way `ctx.lsp`
 * routes navigation queries.
 */
export class LspEditor extends Service implements LspEditorService {
  private readonly providerIds = new Set<string>()
  private readonly routes = new Map<string, Route>()

  constructor(ctx: Context) {
    super(ctx, 'lspEditor')
  }

  registerProvider(provider: LspEditorProvider): () => void {
    const id = provider.id
    if (id.trim() === '') {
      throw new LspError('an LSP editor provider id must be a non-empty string', 'LSP_INVALID_PROVIDER')
    }
    if (this.providerIds.has(id)) {
      throw new LspError(`an LSP editor provider with id "${id}" is already registered`, 'LSP_CONFLICT')
    }

    const entries = Object.entries(provider.extensionToLanguage)
    if (entries.length === 0) {
      throw new LspError(`LSP editor provider "${id}" registers no file extensions`, 'LSP_INVALID_PROVIDER')
    }

    const pending = new Map<string, Route>()
    for (const [rawExt, languageId] of entries) {
      const ext = normalizeExtension(rawExt)
      if (!EXTENSION_PATTERN.test(ext)) {
        throw new LspError(`LSP editor provider "${id}" maps an invalid extension "${rawExt}"`, 'LSP_INVALID_PROVIDER')
      }
      if (languageId.trim() === '') {
        throw new LspError(`LSP editor provider "${id}" maps extension "${ext}" to an empty language id`, 'LSP_INVALID_PROVIDER')
      }
      if (pending.has(ext)) {
        throw new LspError(`LSP editor provider "${id}" maps extension "${ext}" more than once`, 'LSP_INVALID_PROVIDER')
      }
      pending.set(ext, { provider, languageId })
    }
    for (const ext of pending.keys()) {
      if (this.routes.has(ext)) {
        throw new LspError(`extension "${ext}" is already handled by another LSP editor provider`, 'LSP_CONFLICT')
      }
    }

    const dispose = this.ctx.effect(function* (this: LspEditor) {
      this.providerIds.add(id)
      for (const [ext, route] of pending) this.routes.set(ext, route)
      yield () => {
        this.providerIds.delete(id)
        for (const ext of pending.keys()) this.routes.delete(ext)
      }
    }.bind(this), 'lspEditor.registerProvider()')
    return () => void dispose()
  }

  async syncDocument(request: LspEditorSyncRequest, signal?: AbortSignal): Promise<readonly LspEditorDiagnostic[]> {
    const route = this.routes.get(finalExtension(request.filePath))
    if (route === undefined) {
      throw new LspError(`no LSP editor provider handles "${request.filePath}"`, 'LSP_UNAVAILABLE')
    }
    return route.provider.syncDocument({ ...request, languageId: route.languageId }, signal)
  }

  async closeDocument(request: LspEditorCloseRequest, signal?: AbortSignal): Promise<void> {
    const route = this.routes.get(finalExtension(request.filePath))
    if (route === undefined) {
      throw new LspError(`no LSP editor provider handles "${request.filePath}"`, 'LSP_UNAVAILABLE')
    }
    await route.provider.closeDocument({ ...request, languageId: route.languageId }, signal)
  }

  async hoverDocument(request: LspEditorHoverRequest, signal?: AbortSignal): Promise<LspEditorHover | null> {
    const route = this.routes.get(finalExtension(request.filePath))
    if (route === undefined) {
      throw new LspError(`no LSP editor provider handles "${request.filePath}"`, 'LSP_UNAVAILABLE')
    }
    return route.provider.hoverDocument({ ...request, languageId: route.languageId }, signal)
  }
}

function normalizeExtension(ext: string): string {
  const lower = ext.toLowerCase()
  return lower.startsWith('.') ? lower : `.${lower}`
}

export default LspEditor
