import { describe, expect, it } from 'vitest'
import {
  browserTabCloseMenuState,
  tabIdsForCloseScope,
  wouldCloseEveryBrowserTab,
} from '../src/client/browser-tab-close-scope.ts'

const tabs = [
  { tabId: 'a', url: 'about:blank', title: 'A', canGoBack: false, canGoForward: false },
  { tabId: 'b', url: 'about:blank', title: 'B', canGoBack: false, canGoForward: false },
  { tabId: 'c', url: 'about:blank', title: 'C', canGoBack: false, canGoForward: false },
]

describe('browser tab close scope', () => {
  it('maps bulk-close scopes to tab ids', () => {
    expect(tabIdsForCloseScope(tabs, 'b', 'current')).toEqual(['b'])
    expect(tabIdsForCloseScope(tabs, 'b', 'others')).toEqual(['a', 'c'])
    expect(tabIdsForCloseScope(tabs, 'b', 'left')).toEqual(['a'])
    expect(tabIdsForCloseScope(tabs, 'b', 'right')).toEqual(['c'])
    expect(tabIdsForCloseScope(tabs, 'b', 'all')).toEqual(['a', 'b', 'c'])
  })

  it('disables close-all rows when only one tab remains', () => {
    expect(browserTabCloseMenuState(tabs, 'b')).toEqual({
      closeCurrentDisabled: false,
      closeOthersDisabled: false,
      closeLeftDisabled: false,
      closeRightDisabled: false,
      closeAllDisabled: false,
    })
    expect(browserTabCloseMenuState([tabs[0]!], 'a')).toEqual({
      closeCurrentDisabled: true,
      closeOthersDisabled: true,
      closeLeftDisabled: true,
      closeRightDisabled: true,
      closeAllDisabled: true,
    })
  })

  it('detects attempts to close every tab', () => {
    expect(wouldCloseEveryBrowserTab(tabs, ['a', 'b', 'c'])).toBe(true)
    expect(wouldCloseEveryBrowserTab(tabs, ['a', 'b'])).toBe(false)
  })
})
