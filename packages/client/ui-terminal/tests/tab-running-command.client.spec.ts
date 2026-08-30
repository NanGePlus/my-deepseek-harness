import { describe, expect, it } from 'vitest'
import { terminalTabHasRunningCommand } from '../src/client/tab-running-command.ts'

describe('terminalTabHasRunningCommand', () => {
  it('treats idle shell titles as not running', () => {
    expect(terminalTabHasRunningCommand({ sessionId: 'a', title: 'zsh', profileId: 'zsh' })).toBe(false)
    expect(terminalTabHasRunningCommand({ sessionId: 'b', title: 'bash', profileId: 'bash' })).toBe(false)
    expect(terminalTabHasRunningCommand({ sessionId: 'c', title: '-zsh', profileId: 'zsh' })).toBe(false)
  })

  it('treats foreground command titles as running', () => {
    expect(terminalTabHasRunningCommand({ sessionId: 'a', title: 'node', profileId: 'zsh' })).toBe(true)
    expect(terminalTabHasRunningCommand({
      sessionId: 'b',
      title: '~/demo — python py_env.py',
      titlePath: '~/demo',
      titleCommand: 'python py_env.py',
      profileId: 'zsh',
    })).toBe(true)
  })
})
