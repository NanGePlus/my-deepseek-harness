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
})
