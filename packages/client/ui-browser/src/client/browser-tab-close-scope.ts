/** Browser tab-bar bulk close scopes (PRD embedded-browser context menu). */

import type { BrowserTabRow } from './stores.ts'

/** One bulk-close operation relative to the context-menu anchor tab. */
export type BrowserTabCloseScope = 'current' | 'others' | 'all' | 'left' | 'right'

/**
 * Zero-based index of the anchor tab in display order.
 * @param tabs - open tabs.
 * @param anchorTabId - right-clicked tab id.
 */
export function anchorBrowserTabIndex(tabs: readonly BrowserTabRow[], anchorTabId: string): number {
  return tabs.findIndex(tab => tab.tabId === anchorTabId)
}

/**
 * Tab ids to close for one scope.
 * @param tabs - open tabs in display order.
 * @param anchorTabId - right-clicked tab id.
 * @param scope - bulk-close scope.
 */
export function tabIdsForCloseScope(
  tabs: readonly BrowserTabRow[],
  anchorTabId: string,
  scope: BrowserTabCloseScope,
): readonly string[] {
  if (tabs.length === 0) return []
  const index = anchorBrowserTabIndex(tabs, anchorTabId)
  if (index < 0) return []
  switch (scope) {
    case 'current':
      return [anchorTabId]
    case 'all':
      return tabs.map(tab => tab.tabId)
    case 'others':
      return tabs.filter(tab => tab.tabId !== anchorTabId).map(tab => tab.tabId)
    case 'left':
      return tabs.slice(0, index).map(tab => tab.tabId)
    case 'right':
      return tabs.slice(index + 1).map(tab => tab.tabId)
  }
}

/**
 * Tab id to select after a bulk close when the anchor survives.
 * @param tabs - open tabs in display order.
 * @param anchorTabId - right-clicked tab id.
 * @param scope - bulk-close scope.
 */
export function surviveTabIdAfterClose(
  tabs: readonly BrowserTabRow[],
  anchorTabId: string,
  scope: BrowserTabCloseScope,
): string | undefined {
  if (anchorBrowserTabIndex(tabs, anchorTabId) < 0) return undefined
  switch (scope) {
    case 'current':
    case 'all':
      return undefined
    case 'others':
    case 'left':
    case 'right':
      return anchorTabId
  }
}

/** Disabled flags for bulk-close context-menu rows. */
export interface BrowserTabCloseMenuState {
  closeCurrentDisabled: boolean
  closeOthersDisabled: boolean
  closeLeftDisabled: boolean
  closeRightDisabled: boolean
  closeAllDisabled: boolean
}

/**
 * True when closing the given tab ids would remove every open tab.
 * @param tabs - open tabs in display order.
 * @param tabIds - candidate tab ids to close.
 */
export function wouldCloseEveryBrowserTab(
  tabs: readonly BrowserTabRow[],
  tabIds: readonly string[],
): boolean {
  if (tabs.length === 0 || tabIds.length === 0) return false
  const closing = new Set(tabIds)
  return tabs.every(tab => closing.has(tab.tabId))
}

/**
 * Disabled flags for the tab context menu anchored on one tab id.
 * @param tabs - open tabs in display order.
 * @param anchorTabId - right-clicked tab id.
 */
export function browserTabCloseMenuState(
  tabs: readonly BrowserTabRow[],
  anchorTabId: string,
): BrowserTabCloseMenuState {
  const index = anchorBrowserTabIndex(tabs, anchorTabId)
  const lastTab = tabs.length <= 1
  return {
    closeCurrentDisabled: lastTab,
    closeOthersDisabled: lastTab,
    closeLeftDisabled: index <= 0,
    closeRightDisabled: index < 0 || index >= tabs.length - 1,
    closeAllDisabled: lastTab,
  }
}
