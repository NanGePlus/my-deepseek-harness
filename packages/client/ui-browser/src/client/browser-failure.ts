/** Host browse failure mapping for the embedded browser panel. */
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'

/** Store actions used when reporting inline browser failures. */
export type BrowserFailureActions = {
  setInlineError: (workspaceId: WorkspaceId, inlineError: string | undefined) => void
  setBrowserUnavailable: (workspaceId: WorkspaceId, reason: string | undefined) => void
  setNavError: (workspaceId: WorkspaceId, navError: string | undefined) => void
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

/** True when Host cannot start Playwright / Chromium for the Workspace browser pool. */
export function isBrowserUnavailableError(error: unknown): boolean {
  return error instanceof DirectoryBrowseError && error.rpcError.code === 'browser-unavailable'
}

/** True when a Host browser RPC names a tab id that is no longer in the Registry. */
export function isBrowserTabNotFoundError(error: unknown): boolean {
  return error instanceof DirectoryBrowseError && error.rpcError.code === 'browser-tab-not-found'
}

/** Map a Host failure to the inline error surface. */
export function reportBrowserFailure(
  actions: BrowserFailureActions,
  workspaceId: WorkspaceId,
  error: unknown,
  surface: 'inline' | 'nav' | 'unavailable' = 'inline',
): void {
  if (error instanceof DirectoryBrowseError && isIgnorableBrowseError(error)) return
  const message = browseErrorMessage(error)
  if (message === undefined) return
  if (surface === 'unavailable' || isBrowserUnavailableError(error)) {
    actions.setBrowserUnavailable(workspaceId, message)
    return
  }
  if (surface === 'nav') {
    actions.setNavError(workspaceId, message)
    return
  }
  actions.setInlineError(workspaceId, message)
}
