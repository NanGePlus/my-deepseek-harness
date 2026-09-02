/** Editor chrome helpers for LSP diagnostics presentation. */

import type { HostLspDiagnostic } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Whether an LSP sync response still matches the latest scheduled document version.
 * @param responseVersion - version sent with the sync request.
 * @param currentVersion - latest version recorded for the path; `undefined` when closed.
 */
export function shouldApplyLspSyncDiagnostics(
  responseVersion: number,
  currentVersion: number | undefined,
): boolean {
  return currentVersion === responseVersion
}

/**
 * Drop diagnostics whose ranges fall outside the current buffer line count.
 * Stale language-server batches can reference lines that no longer exist after an edit.
 * @param text - current edit-buffer text.
 * @param diagnostics - normalized host diagnostics for the sync response.
 */
export function filterDiagnosticsForText(
  text: string,
  diagnostics: readonly HostLspDiagnostic[],
): readonly HostLspDiagnostic[] {
  const lineCount = text.length === 0 ? 1 : text.split('\n').length
  return diagnostics.filter((item) => {
    const { start, end } = item.range
    if (start.line < 0 || end.line < 0) return false
    if (start.line >= lineCount || end.line >= lineCount) return false
    if (end.line === start.line && end.character < start.character) return false
    return true
  })
}

/**
 * Count error-severity diagnostics for one file tab.
 * @param diagnostics - normalized host diagnostics for the tab path.
 */
export function lspErrorCount(diagnostics: readonly HostLspDiagnostic[] | undefined): number {
  if (diagnostics === undefined || diagnostics.length === 0) return 0
  let count = 0
  for (const item of diagnostics) {
    if (item.severity === 'error') count += 1
  }
  return count
}
