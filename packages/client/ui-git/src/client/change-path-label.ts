/** Split a repository-relative change path for Git-panel row labels. */

import type { GitWorkingTreeChangeKind } from '@deepseek-ai/dsh-client-runtime/client'

/** File name and parent directory segments of one repository-relative path. */
export interface ChangePathLabel {
  /** Final path segment shown as the primary label. */
  fileName: string
  /** Parent directory relative to the repository root; empty at the repository root. */
  parentDir: string
}

/**
 * Split a repository-relative path into VS Code-style row label parts.
 * @param relativePath - path relative to the Git repository root.
 */
export function splitChangePath(relativePath: string): ChangePathLabel {
  const normalized = relativePath.replaceAll('\\', '/')
  const slash = normalized.lastIndexOf('/')
  if (slash === -1) return { fileName: normalized, parentDir: '' }
  return { fileName: normalized.slice(slash + 1), parentDir: normalized.slice(0, slash) }
}

/**
 * Map a working-tree change kind to the single-letter Git status shown on change rows.
 * @param kind - Host working-tree change kind.
 */
export function changeKindLetter(kind: GitWorkingTreeChangeKind): 'M' | 'U' | 'D' {
  switch (kind) {
    case 'untracked': return 'U'
    case 'deleted': return 'D'
    default: return 'M'
  }
}
