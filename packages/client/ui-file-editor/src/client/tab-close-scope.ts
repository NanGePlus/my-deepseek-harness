/** Tab-bar bulk close scopes (VS Code–style context menu). */

import type { EditorTab } from './stores.ts'

/** One bulk-close operation relative to the context-menu anchor tab. */
export type TabCloseScope = 'current' | 'others' | 'all' | 'left' | 'right'

/**
 * Zero-based index of the anchor tab in display order.
 * @param tabs - open tabs.
 * @param anchorPath - right-clicked tab path.
 */
export function anchorTabIndex(tabs: readonly EditorTab[], anchorPath: string): number {
  return tabs.findIndex(tab => tab.path === anchorPath)
}

/**
 * Host-absolute paths to close for one scope.
 * @param tabs - open tabs in display order.
 * @param anchorPath - right-clicked tab path.
 * @param scope - bulk-close scope.
 */
export function pathsForTabCloseScope(
  tabs: readonly EditorTab[],
  anchorPath: string,
  scope: TabCloseScope,
): readonly string[] {
  if (tabs.length === 0) return []
  const index = anchorTabIndex(tabs, anchorPath)
  if (index < 0) return []
  switch (scope) {
    case 'current':
      return [anchorPath]
    case 'all':
      return tabs.map(tab => tab.path)
    case 'others':
      return tabs.filter(tab => tab.path !== anchorPath).map(tab => tab.path)
    case 'left':
      return tabs.slice(0, index).map(tab => tab.path)
    case 'right':
      return tabs.slice(index + 1).map(tab => tab.path)
  }
}

/**
 * Tab path to focus after a bulk close when the anchor survives.
 * @param tabs - open tabs in display order.
 * @param anchorPath - right-clicked tab path.
 * @param scope - bulk-close scope.
 */
export function survivePathAfterTabClose(
  tabs: readonly EditorTab[],
  anchorPath: string,
  scope: TabCloseScope,
): string | undefined {
  if (anchorTabIndex(tabs, anchorPath) < 0) return undefined
  switch (scope) {
    case 'current':
    case 'all':
      return undefined
    case 'others':
    case 'left':
    case 'right':
      return anchorPath
  }
}

/** Disabled flags for bulk-close context-menu rows. */
export interface TabCloseMenuState {
  closeOthersDisabled: boolean
  closeLeftDisabled: boolean
  closeRightDisabled: boolean
}

/**
 * Open tab paths removed when a tree path is deleted.
 * A deleted directory closes every tab under that directory prefix.
 * @param deletedPath - Host-absolute deleted file or directory path.
 * @param tabPaths - open tab paths.
 */
export function tabPathsAffectedByDelete(
  deletedPath: string,
  tabPaths: readonly string[],
): readonly string[] {
  const normalized = deletedPath.replace(/[/\\]+$/, '')
  return tabPaths.filter(path => path === normalized || path.startsWith(`${normalized}/`))
}

/**
 * Disabled flags for the tab context menu anchored on one path.
 * @param tabs - open tabs in display order.
 * @param anchorPath - right-clicked tab path.
 */
export function tabCloseMenuState(
  tabs: readonly EditorTab[],
  anchorPath: string,
): TabCloseMenuState {
  const index = anchorTabIndex(tabs, anchorPath)
  return {
    closeOthersDisabled: tabs.length <= 1,
    closeLeftDisabled: index <= 0,
    closeRightDisabled: index < 0 || index >= tabs.length - 1,
  }
}
