/** Terminal tab-bar bulk close scopes (VS Code–style context menu). */

import type { TerminalTabRow } from './stores.ts'

/** One bulk-close operation relative to the context-menu anchor tab. */
export type TerminalTabCloseScope = 'current' | 'others' | 'all' | 'left' | 'right'

/**
 * Zero-based index of the anchor tab in display order.
 * @param tabs - open tabs.
 * @param anchorSessionId - right-clicked tab session id.
 */
export function anchorTerminalTabIndex(tabs: readonly TerminalTabRow[], anchorSessionId: string): number {
  return tabs.findIndex(tab => tab.sessionId === anchorSessionId)
}

/**
 * Session ids to close for one scope.
 * @param tabs - open tabs in display order.
 * @param anchorSessionId - right-clicked tab session id.
 * @param scope - bulk-close scope.
 */
export function sessionIdsForTabCloseScope(
  tabs: readonly TerminalTabRow[],
  anchorSessionId: string,
  scope: TerminalTabCloseScope,
): readonly string[] {
  if (tabs.length === 0) return []
  const index = anchorTerminalTabIndex(tabs, anchorSessionId)
  if (index < 0) return []
  switch (scope) {
    case 'current':
      return [anchorSessionId]
    case 'all':
      return tabs.map(tab => tab.sessionId)
    case 'others':
      return tabs.filter(tab => tab.sessionId !== anchorSessionId).map(tab => tab.sessionId)
    case 'left':
      return tabs.slice(0, index).map(tab => tab.sessionId)
    case 'right':
      return tabs.slice(index + 1).map(tab => tab.sessionId)
  }
}

/**
 * Session id to focus after a bulk close when the anchor survives.
 * @param tabs - open tabs in display order.
 * @param anchorSessionId - right-clicked tab session id.
 * @param scope - bulk-close scope.
 */
export function surviveSessionIdAfterTabClose(
  tabs: readonly TerminalTabRow[],
  anchorSessionId: string,
  scope: TerminalTabCloseScope,
): string | undefined {
  if (anchorTerminalTabIndex(tabs, anchorSessionId) < 0) return undefined
  switch (scope) {
    case 'current':
    case 'all':
      return undefined
    case 'others':
    case 'left':
    case 'right':
      return anchorSessionId
  }
}

/** Disabled flags for bulk-close context-menu rows. */
export interface TerminalTabCloseMenuState {
  closeCurrentDisabled: boolean
  closeOthersDisabled: boolean
  closeLeftDisabled: boolean
  closeRightDisabled: boolean
  closeAllDisabled: boolean
}

/**
 * True when closing the given session ids would remove every open tab.
 * @param tabs - open tabs in display order.
 * @param sessionIds - candidate session ids to close.
 */
export function wouldCloseEveryTerminalTab(
  tabs: readonly TerminalTabRow[],
  sessionIds: readonly string[],
): boolean {
  if (tabs.length === 0 || sessionIds.length === 0) return false
  const closing = new Set(sessionIds)
  return tabs.every(tab => closing.has(tab.sessionId))
}

/**
 * Disabled flags for the tab context menu anchored on one session id.
 * @param tabs - open tabs in display order.
 * @param anchorSessionId - right-clicked tab session id.
 */
export function terminalTabCloseMenuState(
  tabs: readonly TerminalTabRow[],
  anchorSessionId: string,
): TerminalTabCloseMenuState {
  const index = anchorTerminalTabIndex(tabs, anchorSessionId)
  const lastTab = tabs.length <= 1
  return {
    closeCurrentDisabled: lastTab,
    closeOthersDisabled: lastTab,
    closeLeftDisabled: index <= 0,
    closeRightDisabled: index < 0 || index >= tabs.length - 1,
    closeAllDisabled: lastTab,
  }
}
