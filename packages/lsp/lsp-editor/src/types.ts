/**
 * Editor LSP seam vocabulary: persistent document sync and normalized diagnostics for Monaco.
 * @module @deepseek-ai/dsh-lsp-editor/types
 */

import type { LspProviderId } from '@deepseek-ai/dsh-lsp'
import type { LspPosition, LspRange } from '@deepseek-ai/dsh-lsp'

/** Diagnostic severity normalized for Monaco marker mapping. */
export type LspEditorDiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

/** One squiggle from `textDocument/publishDiagnostics`. */
export interface LspEditorDiagnostic {
  /** Human-readable message text. */
  readonly message: string
  /** Normalized severity. */
  readonly severity: LspEditorDiagnosticSeverity
  /** Zero-based UTF-16 range in the synced buffer. */
  readonly range: LspRange
}

/** Caller request to sync one open editor buffer with its language server. */
export interface LspEditorSyncRequest {
  /** Host-absolute or workspace-relative source path. */
  readonly filePath: string
  /** Current editor buffer text. */
  readonly text: string
  /** Monotonic document version from the client (>= 1). */
  readonly version: number
  /** Workspace root the provider resolves against. */
  readonly workspaceRoot: string
}

/** Caller request for hover at one cursor position in a synced editor buffer. */
export interface LspEditorHoverRequest {
  /** Host-absolute or workspace-relative source path. */
  readonly filePath: string
  /** Zero-based UTF-16 cursor position in the synced buffer. */
  readonly position: LspPosition
  /** Workspace root the provider resolves against. */
  readonly workspaceRoot: string
  /** Current editor buffer text. */
  readonly text: string
  /** Monotonic document version from the client (>= 1). */
  readonly version: number
}

/** Normalized hover content for Monaco, or `null` when the server has none. */
export interface LspEditorHover {
  /** Markdown or plaintext hover body. */
  readonly contents: string
  /** Optional range the hover applies to. */
  readonly range?: LspRange
}

/** Provider-facing hover request with the resolved language id. */
export interface LspEditorProviderHoverRequest extends LspEditorHoverRequest {
  /** LSP language id derived from the provider's extension mapping. */
  readonly languageId: string
}

/** Caller request to close one editor document in the language server. */
export interface LspEditorCloseRequest {
  /** Host-absolute or workspace-relative source path. */
  readonly filePath: string
  /** Workspace root the provider resolves against. */
  readonly workspaceRoot: string
}

/** Provider-facing sync request with the resolved language id. */
export interface LspEditorProviderSyncRequest extends LspEditorSyncRequest {
  /** LSP language id derived from the provider's extension mapping. */
  readonly languageId: string
}

/** Provider-facing close request with the resolved language id. */
export interface LspEditorProviderCloseRequest extends LspEditorCloseRequest {
  /** LSP language id derived from the provider's extension mapping. */
  readonly languageId: string
}

/** One editor LSP backend registered by extension mapping. */
export interface LspEditorProvider {
  /** Branded provider id shared with the navigation seam when co-hosted. */
  readonly id: LspProviderId
  /** Lowercase dotted extension → LSP language id. */
  readonly extensionToLanguage: Readonly<Record<string, string>>
  /**
   * Open or update a document and return the latest diagnostics snapshot.
   * @param request - resolved sync request.
   * @param signal - optional cancellation.
   */
  syncDocument(request: LspEditorProviderSyncRequest, signal?: AbortSignal): Promise<readonly LspEditorDiagnostic[]>
  /**
   * Close a previously synced document.
   * @param request - resolved close request.
   * @param signal - optional cancellation.
   */
  closeDocument(request: LspEditorProviderCloseRequest, signal?: AbortSignal): Promise<void>
  /**
   * Query hover for one open document at a cursor position.
   * @param request - resolved hover request.
   * @param signal - optional cancellation.
   */
  hoverDocument(request: LspEditorProviderHoverRequest, signal?: AbortSignal): Promise<LspEditorHover | null>
}

/** Editor LSP service registered on `ctx.lspEditor`. */
export interface LspEditorService {
  /** Register one editor provider; returns a disposer. */
  registerProvider(provider: LspEditorProvider): () => void
  /** Sync one buffer and return diagnostics for the file. */
  syncDocument(request: LspEditorSyncRequest, signal?: AbortSignal): Promise<readonly LspEditorDiagnostic[]>
  /** Close one synced document. */
  closeDocument(request: LspEditorCloseRequest, signal?: AbortSignal): Promise<void>
  /** Query hover for one synced document. */
  hoverDocument(request: LspEditorHoverRequest, signal?: AbortSignal): Promise<LspEditorHover | null>
}

export type { LspPosition, LspRange }
