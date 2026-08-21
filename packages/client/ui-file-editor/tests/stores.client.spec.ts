import { describe, expect, it } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { createFileEditorStore, tabIsDirty } from '../src/client/stores.ts'

const WID = 'ws1' as WorkspaceId

describe('file editor store', () => {
  it('ignores buffer and save updates on non-text tabs and missing paths', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab(WID, {
      kind: 'preview',
      path: '/w/logo.png',
      name: 'logo.png',
      mediaType: 'image/png',
      data: 'abc',
    })
    instance.actions.setBuffer(WID, '/w/logo.png', 'nope')
    instance.actions.markSaved(WID, '/w/logo.png')
    instance.actions.setBuffer(WID, '/missing', 'x')
    instance.actions.markSaved(WID, '/missing')
    const preview = instance.getSnapshot().byWorkspace[WID]?.tabs[0]
    expect(preview?.kind).toBe('preview')
    expect(tabIsDirty(preview!)).toBe(false)
  })

  it('renames an open tab path and keeps focus on the new path', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab(WID, {
      kind: 'text',
      path: '/w/README.md',
      name: 'README.md',
      language: 'markdown',
      buffer: 'a',
      saved: 'a',
    })
    instance.actions.renameTabPath(WID, '/w/README.md', '/w/GUIDE.md', 'GUIDE.md')
    const tab = instance.getSnapshot().byWorkspace[WID]?.tabs[0]
    expect(tab?.path).toBe('/w/GUIDE.md')
    expect(tab?.name).toBe('GUIDE.md')
    expect(instance.getSnapshot().byWorkspace[WID]?.activePath).toBe('/w/GUIDE.md')
  })

  it('reloadTextTab replaces buffer and saved text for a text tab', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab(WID, {
      kind: 'text',
      path: '/w/README.md',
      name: 'README.md',
      language: 'markdown',
      buffer: 'local',
      saved: 'initial',
    })
    instance.actions.reloadTextTab(WID, '/w/README.md', 'external\n')
    const tab = instance.getSnapshot().byWorkspace[WID]?.tabs[0]
    expect(tab?.kind).toBe('text')
    if (tab?.kind === 'text') {
      expect(tab.buffer).toBe('external\n')
      expect(tab.saved).toBe('external\n')
    }
    expect(tabIsDirty(tab!)).toBe(false)
  })

  it('closeAllTabs clears every tab and the active path for one Workspace', () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab(WID, {
      kind: 'text', path: '/a', name: 'a.ts', language: 'typescript', buffer: 'x', saved: 'x',
    })
    instance.actions.openTab(WID, {
      kind: 'text', path: '/b', name: 'b.ts', language: 'typescript', buffer: 'y', saved: 'y',
    })
    instance.actions.closeAllTabs(WID)
    expect(instance.getSnapshot().byWorkspace[WID]).toEqual({ tabs: [], activePath: undefined })
  })

  it('keeps independent partitions per Workspace', () => {
    const instance = createFileEditorStore().create()
    const other = 'ws2' as WorkspaceId
    instance.actions.openTab(WID, {
      kind: 'text', path: '/a', name: 'a.ts', language: 'typescript', buffer: 'x', saved: 'x',
    })
    instance.actions.openTab(other, {
      kind: 'text', path: '/b', name: 'b.ts', language: 'typescript', buffer: 'y', saved: 'y',
    })
    expect(instance.getSnapshot().byWorkspace[WID]?.activePath).toBe('/a')
    expect(instance.getSnapshot().byWorkspace[other]?.activePath).toBe('/b')
  })
})
