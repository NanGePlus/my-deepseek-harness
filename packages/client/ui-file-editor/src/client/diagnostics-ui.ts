/** Editor chrome helpers for LSP diagnostics presentation. */

import type { HostLspDiagnostic } from '@deepseek-ai/dsh-client-runtime/client'

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
