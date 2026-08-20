/** Flatten a lazily loaded file-tree cache into the rows the virtual list paints. */

import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** One visible file-tree row after expansion and filename filtering. */
export interface VisibleTreeRow {
  /** The Host-owned entry for this row. */
  entry: WorkspaceEntry
  /** Indentation level; the Workspace root's children are 0. */
  depth: number
  /** True when this directory is expanded in the client cache. */
  expanded: boolean
  /** True while this directory's listing request is in flight. */
  loading: boolean
}

/**
 * Walk cached directory levels into a flat row list. Filename filtering keeps
 * a node when its name matches or a currently loaded descendant matches;
 * collapsed unread children are not fetched.
 * @param entries - the bound Workspace root's direct children.
 * @param expanded - absolute paths the user has expanded.
 * @param loading - absolute paths with an in-flight listing.
 * @param childrenByPath - cached listings keyed by directory path.
 * @param filter - case-insensitive filename needle; empty keeps every loaded row.
 * @returns depth-ordered rows for the virtual list.
 */
export function flattenVisibleTree(
  entries: readonly WorkspaceEntry[],
  expanded: ReadonlySet<string>,
  loading: ReadonlySet<string>,
  childrenByPath: ReadonlyMap<string, readonly WorkspaceEntry[]>,
  filter: string,
): VisibleTreeRow[] {
  return walk(entries, 0, expanded, loading, childrenByPath, filter.trim().toLowerCase())
}

/**
 * Recurse one cached directory level.
 * @param entries - siblings at this depth.
 * @param depth - indentation level.
 * @param expanded - expanded directory paths.
 * @param loading - in-flight directory paths.
 * @param childrenByPath - cached listings.
 * @param needle - lowercased filename filter; empty keeps every node.
 * @returns visible rows at this level and below.
 */
function walk(
  entries: readonly WorkspaceEntry[],
  depth: number,
  expanded: ReadonlySet<string>,
  loading: ReadonlySet<string>,
  childrenByPath: ReadonlyMap<string, readonly WorkspaceEntry[]>,
  needle: string,
): VisibleTreeRow[] {
  const rows: VisibleTreeRow[] = []
  for (const entry of entries) {
    const isExpanded = expanded.has(entry.path)
    const childEntries = entry.isDirectory && isExpanded
      ? (childrenByPath.get(entry.path) ?? [])
      : []
    const childRows = childEntries.length === 0
      ? []
      : walk(childEntries, depth + 1, expanded, loading, childrenByPath, needle)
    const matches = needle === '' || entry.name.toLowerCase().includes(needle)
    if (!matches && childRows.length === 0) continue
    rows.push({
      entry,
      depth,
      expanded: isExpanded,
      loading: loading.has(entry.path),
    })
    rows.push(...childRows)
  }
  return rows
}

/**
 * Choose which flattened rows to paint: prefer the virtualizer window, and
 * fall back to every loaded row when the window is empty (unmeasured scrollport).
 * @param rows - flattened visible tree.
 * @param virtualItems - virtualizer window; empty means "not yet measured".
 * @param rowHeight - estimated row height in CSS pixels.
 * @returns rows with their vertical offsets.
 */
export function paintVisibleRows(
  rows: readonly VisibleTreeRow[],
  virtualItems: readonly { index: number; start: number }[],
  rowHeight: number,
): { row: VisibleTreeRow; start: number }[] {
  if (virtualItems.length === 0) {
    return rows.map((row, index) => ({ row, start: index * rowHeight }))
  }
  const painted: { row: VisibleTreeRow; start: number }[] = []
  for (const item of virtualItems) {
    const row = rows[item.index]
    if (row !== undefined) painted.push({ row, start: item.start })
  }
  return painted
}
