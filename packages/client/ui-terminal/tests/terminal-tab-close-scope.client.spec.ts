import { describe, expect, it } from 'vitest'
import {
  anchorTerminalTabIndex,
  sessionIdsForTabCloseScope,
  surviveSessionIdAfterTabClose,
  terminalTabCloseMenuState,
  wouldCloseEveryTerminalTab,
} from '../src/client/terminal-tab-close-scope.ts'
import type { TerminalTabRow } from '../src/client/stores.ts'

const tabs: TerminalTabRow[] = [
  { sessionId: 'a', title: 'first', profileId: 'zsh' },
  { sessionId: 'b', title: 'second', profileId: 'bash' },
  { sessionId: 'c', title: 'third', profileId: 'zsh' },
]

describe('terminal-tab-close-scope', () => {
  it('resolves anchor index and menu disabled flags', () => {
    expect(anchorTerminalTabIndex(tabs, 'missing')).toBe(-1)
    expect(anchorTerminalTabIndex(tabs, 'b')).toBe(1)
    expect(terminalTabCloseMenuState(tabs, 'a')).toEqual({
      closeCurrentDisabled: false,
      closeOthersDisabled: false,
      closeLeftDisabled: true,
      closeRightDisabled: false,
      closeAllDisabled: false,
    })
    expect(terminalTabCloseMenuState(tabs, 'c')).toEqual({
      closeCurrentDisabled: false,
      closeOthersDisabled: false,
      closeLeftDisabled: false,
      closeRightDisabled: true,
      closeAllDisabled: false,
    })
    expect(terminalTabCloseMenuState([tabs[0]!], 'a')).toEqual({
      closeCurrentDisabled: true,
      closeOthersDisabled: true,
      closeLeftDisabled: true,
      closeRightDisabled: true,
      closeAllDisabled: true,
    })
  })

  it('detects when a close would remove every tab', () => {
    expect(wouldCloseEveryTerminalTab(tabs, ['a'])).toBe(false)
    expect(wouldCloseEveryTerminalTab(tabs, ['a', 'b', 'c'])).toBe(true)
    expect(wouldCloseEveryTerminalTab([tabs[0]!], ['a'])).toBe(true)
    expect(wouldCloseEveryTerminalTab([], ['a'])).toBe(false)
  })

  it('maps close scopes to session ids and survive selection', () => {
    expect(sessionIdsForTabCloseScope(tabs, 'b', 'current')).toEqual(['b'])
    expect(sessionIdsForTabCloseScope(tabs, 'b', 'others')).toEqual(['a', 'c'])
    expect(sessionIdsForTabCloseScope(tabs, 'b', 'left')).toEqual(['a'])
    expect(sessionIdsForTabCloseScope(tabs, 'b', 'right')).toEqual(['c'])
    expect(sessionIdsForTabCloseScope(tabs, 'b', 'all')).toEqual(['a', 'b', 'c'])
    expect(sessionIdsForTabCloseScope(tabs, 'missing', 'current')).toEqual([])

    expect(surviveSessionIdAfterTabClose(tabs, 'b', 'others')).toBe('b')
    expect(surviveSessionIdAfterTabClose(tabs, 'b', 'current')).toBeUndefined()
    expect(surviveSessionIdAfterTabClose(tabs, 'b', 'all')).toBeUndefined()
  })
})
