/** Map Host `git-failed` text onto Git-panel product copy. */

/**
 * True when Git or Host text means this repository has no push remote.
 * @param message - `git-failed` RPC message.
 */
export function isMissingRemoteGitError(message: string): boolean {
  const text = message.toLowerCase()
  return text.includes('no remote configured')
    || text.includes('no configured push destination')
    || text.includes('no such remote')
}

/**
 * True when Git rejected a push because the remote has commits that would not
 * fast-forward.
 * @param message - `git-failed` RPC message.
 */
export function isRejectedPushGitError(message: string): boolean {
  const text = message.toLowerCase()
  return text.includes('[rejected]')
    || text.includes('non-fast-forward')
    || text.includes('(fetch first)')
}
