/** Render helpers for VS Code-style terminal tab titles. */

import type { TerminalTabRow } from './stores.ts'

/**
 * Primary command label shown after the em dash.
 * @param tab - live terminal tab row.
 */
export function terminalTabTitleCommand(tab: TerminalTabRow): string {
  return tab.titleCommand ?? tab.title
}

/**
 * Full tab label for aria attributes and close guards.
 * @param tab - live terminal tab row.
 */
export function terminalTabDisplayTitle(tab: TerminalTabRow): string {
  return terminalTabTitleCommand(tab)
}
