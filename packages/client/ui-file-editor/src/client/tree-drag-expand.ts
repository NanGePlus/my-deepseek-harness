/** Drag-hover auto-expand for collapsed directory rows in the file tree. */

import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** Delay before a collapsed folder expands while a drag hovers its row. */
export const TREE_DRAG_EXPAND_DELAY_MS = 600

/**
 * Whether a drag hover should schedule auto-expand for one directory row.
 * @param entry - tree row entry.
 * @param expandedPaths - currently expanded directory paths.
 * @param sourcePath - Host-absolute path being dragged, when known.
 */
export function shouldScheduleDragExpand(
  entry: WorkspaceEntry,
  expandedPaths: ReadonlySet<string>,
  sourcePath: string | undefined,
): boolean {
  if (!entry.isDirectory) return false
  if (expandedPaths.has(entry.path)) return false
  if (sourcePath === entry.path) return false
  return true
}
