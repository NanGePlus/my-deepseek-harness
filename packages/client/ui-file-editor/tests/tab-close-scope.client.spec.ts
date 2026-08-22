import { describe, expect, it } from 'vitest'
import type { EditorTab } from '../src/client/stores.ts'
import {
  anchorTabIndex,
  pathsForTabCloseScope,
  survivePathAfterTabClose,
  tabCloseMenuState,
} from '../src/client/tab-close-scope.ts'

const tabs: EditorTab[] = [
  { kind: 'text', path: '/w/a.ts', name: 'a.ts', language: 'typescript', buffer: '', saved: '' },
  { kind: 'text', path: '/w/b.ts', name: 'b.ts', language: 'typescript', buffer: '', saved: '' },
  { kind: 'text', path: '/w/c.ts', name: 'c.ts', language: 'typescript', buffer: '', saved: '' },
]

describe('tab close scope', () => {
  it('anchorTabIndex returns the display-order index', () => {
    expect(anchorTabIndex(tabs, '/w/b.ts')).toBe(1)
    expect(anchorTabIndex(tabs, '/w/missing.ts')).toBe(-1)
  })

  it('pathsForTabCloseScope maps each bulk-close scope', () => {
    expect(pathsForTabCloseScope(tabs, '/w/b.ts', 'current')).toEqual(['/w/b.ts'])
    expect(pathsForTabCloseScope(tabs, '/w/b.ts', 'others')).toEqual(['/w/a.ts', '/w/c.ts'])
    expect(pathsForTabCloseScope(tabs, '/w/b.ts', 'left')).toEqual(['/w/a.ts'])
    expect(pathsForTabCloseScope(tabs, '/w/b.ts', 'right')).toEqual(['/w/c.ts'])
    expect(pathsForTabCloseScope(tabs, '/w/b.ts', 'all')).toEqual(['/w/a.ts', '/w/b.ts', '/w/c.ts'])
    expect(pathsForTabCloseScope(tabs, '/w/missing.ts', 'current')).toEqual([])
  })

  it('survivePathAfterTabClose keeps the anchor for partial closes', () => {
    expect(survivePathAfterTabClose(tabs, '/w/b.ts', 'others')).toBe('/w/b.ts')
    expect(survivePathAfterTabClose(tabs, '/w/b.ts', 'left')).toBe('/w/b.ts')
    expect(survivePathAfterTabClose(tabs, '/w/b.ts', 'right')).toBe('/w/b.ts')
    expect(survivePathAfterTabClose(tabs, '/w/b.ts', 'current')).toBeUndefined()
    expect(survivePathAfterTabClose(tabs, '/w/b.ts', 'all')).toBeUndefined()
  })

  it('tabCloseMenuState disables rows at the tab-bar edges', () => {
    expect(tabCloseMenuState(tabs, '/w/a.ts')).toEqual({
      closeOthersDisabled: false,
      closeLeftDisabled: true,
      closeRightDisabled: false,
    })
    expect(tabCloseMenuState(tabs, '/w/c.ts')).toEqual({
      closeOthersDisabled: false,
      closeLeftDisabled: false,
      closeRightDisabled: true,
    })
    expect(tabCloseMenuState([tabs[0]!], '/w/a.ts')).toEqual({
      closeOthersDisabled: true,
      closeLeftDisabled: true,
      closeRightDisabled: true,
    })
  })
})
