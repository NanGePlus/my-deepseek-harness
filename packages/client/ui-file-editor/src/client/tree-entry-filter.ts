/** Drop OS metadata rows from file-tree listings; project dotfiles stay visible. */

import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** Exact basenames omitted from the file-tree UI. */
const TREE_HIDDEN_NAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
])

/**
 * True when a Host listing row should appear in the file tree.
 * @param entry - one workspace listing row.
 * @returns false for OS metadata the tree should omit.
 */
export function isTreeVisibleEntry(entry: Pick<WorkspaceEntry, 'name'>): boolean {
  if (TREE_HIDDEN_NAMES.has(entry.name)) return false
  if (entry.name.startsWith('._')) return false
  return true
}

/**
 * Filter one directory listing to the rows the file tree paints.
 * @param entries - direct children returned by host.listWorkspaceEntries.
 * @returns the subset shown in the tree.
 */
export function filterTreeEntries(entries: readonly WorkspaceEntry[]): WorkspaceEntry[] {
  return entries.filter(isTreeVisibleEntry)
}
