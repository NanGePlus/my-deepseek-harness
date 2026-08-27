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
