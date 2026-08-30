/** Host browse failure mapping for the embedded browser panel. */
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'

/** Store actions used when reporting inline browser failures. */
export type BrowserFailureActions = {
  setInlineError: (workspaceId: WorkspaceId, inlineError: string | undefined) => void
}

/** Return a user-visible Host failure message when one exists. */
export function browseErrorMessage(error: unknown): string | undefined {
  if (error instanceof DirectoryBrowseError) return error.rpcError.message
  if (error instanceof Error) return error.message
  return undefined
}

/** Ignore workspace lookup failures during background handshakes. */
export function isIgnorableBrowseError(error: DirectoryBrowseError): boolean {
  return error.rpcError.code === 'workspace-not-found'
}

/** Map a Host failure to the inline error surface. */
export function reportBrowserFailure(
  actions: BrowserFailureActions,
  workspaceId: WorkspaceId,
  error: unknown,
): void {
  if (error instanceof DirectoryBrowseError && isIgnorableBrowseError(error)) return
  const message = browseErrorMessage(error)
  if (message === undefined) return
  actions.setInlineError(workspaceId, message)
}
