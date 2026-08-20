import { describe, expect, it } from 'vitest'
import { createFileEditorStore, tabIsDirty } from '../src/client/stores.ts'

describe('file editor store', () => {
  it('ignores buffer and save updates on non-text tabs and missing paths', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab({
      kind: 'preview',
      path: '/w/logo.png',
      name: 'logo.png',
      mediaType: 'image/png',
      data: 'abc',
    })
    instance.actions.setBuffer('/w/logo.png', 'nope')
    instance.actions.markSaved('/w/logo.png')
    instance.actions.setBuffer('/missing', 'x')
    instance.actions.markSaved('/missing')
    const preview = instance.getSnapshot().tabs[0]
    expect(preview?.kind).toBe('preview')
    expect(tabIsDirty(preview!)).toBe(false)
  })

  it('renames an open tab path and keeps focus on the new path', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab({
      kind: 'text',
      path: '/w/README.md',
      name: 'README.md',
      language: 'markdown',
      buffer: 'a',
      saved: 'a',
    })
    instance.actions.renameTabPath('/w/README.md', '/w/GUIDE.md', 'GUIDE.md')
    const tab = instance.getSnapshot().tabs[0]
    expect(tab?.path).toBe('/w/GUIDE.md')
    expect(tab?.name).toBe('GUIDE.md')
    expect(instance.getSnapshot().activePath).toBe('/w/GUIDE.md')
  })

  it('reloadTextTab replaces buffer and saved text for a text tab', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab({
      kind: 'text',
      path: '/w/README.md',
      name: 'README.md',
      language: 'markdown',
      buffer: 'local',
      saved: 'initial',
    })
    instance.actions.reloadTextTab('/w/README.md', 'external\n')
    const tab = instance.getSnapshot().tabs[0]
    expect(tab?.kind).toBe('text')
    if (tab?.kind === 'text') {
      expect(tab.buffer).toBe('external\n')
      expect(tab.saved).toBe('external\n')
    }
    expect(tabIsDirty(tab!)).toBe(false)
  })

  it('closeAllTabs clears every tab and the active path', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab({
      kind: 'text', path: '/a', name: 'a.ts', language: 'typescript', buffer: 'x', saved: 'x',
    })
    instance.actions.openTab({
      kind: 'text', path: '/b', name: 'b.ts', language: 'typescript', buffer: 'y', saved: 'y',
    })
    instance.actions.closeAllTabs()
    expect(instance.getSnapshot()).toEqual({ tabs: [], activePath: undefined })
  })
})
