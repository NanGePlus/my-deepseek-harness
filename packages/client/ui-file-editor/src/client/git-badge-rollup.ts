import { parentDirectoryOfPath } from './file-tree-parent.ts'

const LETTER_RANK: Record<string, number> = { M: 3, D: 2, U: 1 }

/**
 * Prefer the stronger badge when rolling a nested letter onto an ancestor folder.
 * @param current - letter already stored for the folder, if any.
 * @param incoming - letter from a descendant path.
 */
function strongerGitLetter(current: string | undefined, incoming: string): string {
  if (current === undefined) return incoming
  return (LETTER_RANK[incoming] ?? 0) > (LETTER_RANK[current] ?? 0) ? incoming : current
}

/**
 * Copy Host gitStatus letters onto ancestor directories so a folder shows U/M/D
 * when porcelain lists only nested files (`--untracked-files=all`).
 * @param entries - Host-absolute path → badge letter.
 * @param workspaceRoot - bound Workspace root; rollup stops there.
 * @returns a new map including ancestor folders.
 */
export function rollupGitBadges(
  entries: ReadonlyMap<string, string>,
  workspaceRoot: string,
): Map<string, string> {
  const rolled = new Map(entries)
  for (const [path, letter] of entries) {
    let current = path
    while (true) {
      const parent = parentDirectoryOfPath(workspaceRoot, current)
      if (parent === current) break
      rolled.set(parent, strongerGitLetter(rolled.get(parent), letter))
      if (parent === workspaceRoot) break
      current = parent
    }
  }
  return rolled
}
