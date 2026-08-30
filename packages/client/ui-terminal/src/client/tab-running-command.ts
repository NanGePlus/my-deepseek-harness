/** Detect foreground commands from Host title polling for close guards. */

import type { TerminalTabRow } from './stores.ts'
import { terminalTabTitleCommand } from './terminal-tab-title.ts'

const IDLE_SHELL_TITLES = new Set(['zsh', 'bash', 'sh', '-zsh', '-bash', '-sh'])

/**
 * True when the tab title reports a foreground process other than the idle shell.
 * @param tab - live terminal tab row.
 */
export function terminalTabHasRunningCommand(tab: TerminalTabRow): boolean {
  const command = terminalTabTitleCommand(tab)
  if (command === tab.profileId) return false
  if (command === `-${tab.profileId}`) return false
  if (IDLE_SHELL_TITLES.has(command)) return false
  return true
}
