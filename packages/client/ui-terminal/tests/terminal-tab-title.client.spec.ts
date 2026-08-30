import { describe, expect, it } from 'vitest'
import { terminalTabDisplayTitle, terminalTabTitleCommand } from '../src/client/terminal-tab-title.ts'

describe('terminal tab title helpers', () => {
  it('prefers structured command labels', () => {
    const tab = {
      sessionId: 'a',
      title: 'legacy',
      titlePath: '~/demo',
      titleCommand: 'python py_env.py',
      profileId: 'zsh',
    }
    expect(terminalTabTitleCommand(tab)).toBe('python py_env.py')
    expect(terminalTabDisplayTitle(tab)).toBe('python py_env.py')
  })

  it('falls back to the legacy title string', () => {
    const tab = { sessionId: 'a', title: 'node', profileId: 'zsh' }
    expect(terminalTabTitleCommand(tab)).toBe('node')
    expect(terminalTabDisplayTitle(tab)).toBe('node')
  })

  it('uses titleCommand without the path prefix', () => {
    const tab = {
      sessionId: 'a',
      title: '~/demo — python py_env.py',
      titlePath: '~/demo',
      titleCommand: 'python py_env.py',
      profileId: 'zsh',
    }
    expect(terminalTabDisplayTitle(tab)).toBe('python py_env.py')
  })
})
