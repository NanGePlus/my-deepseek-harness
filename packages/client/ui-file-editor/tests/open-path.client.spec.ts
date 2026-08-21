// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { createFileEditorStore } from '../src/client/stores.ts'
import { openPathInEditor, type OpenPathReadFile } from '../src/client/open-path.ts'

const WID = 'ws1' as WorkspaceId

describe('openPathInEditor', () => {
  it('focuses an existing tab without reading from the Host', async () => {
    const instance = createFileEditorStore().create()
    instance.actions.openTab(WID, {
      kind: 'text',
      path: '/w/a.md',
      name: 'a.md',
      language: 'markdown',
      buffer: 'x',
      saved: 'x',
    })
    const readFile = vi.fn()
    const ok = await openPathInEditor(instance, readFile, WID, '/w/a.md')
    expect(ok).toBe(true)
    expect(readFile).not.toHaveBeenCalled()
    expect(instance.store.getSnapshot().byWorkspace[WID]?.activePath).toBe('/w/a.md')
  })

  it('opens text and preview tabs and records non-openable paths without I/O', async () => {
    const instance = createFileEditorStore().create()
    const readFile = vi.fn(async (_wid, path, kind) => {
      if (kind === 'bytes') {
        return { kind: 'bytes' as const, path, data: 'abc', mediaType: 'image/png' }
      }
      return { kind: 'text' as const, path, text: 'hello' }
    })
    await expect(openPathInEditor(instance, readFile, WID, '/w/readme.md')).resolves.toBe(true)
    await expect(openPathInEditor(instance, readFile, WID, '/w/logo.png')).resolves.toBe(true)
    await expect(openPathInEditor(instance, readFile, WID, '/w/app.wasm')).resolves.toBe(true)
    const state = instance.store.getSnapshot().byWorkspace[WID]
    expect(state?.tabs.map(tab => tab.kind)).toEqual(['text', 'preview', 'non-openable'])
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  it('returns false when the Host read fails or returns the wrong kind', async () => {
    const instance = createFileEditorStore().create()
    const readFile = vi.fn<OpenPathReadFile>(async () => { throw new Error('offline') })
    await expect(openPathInEditor(instance, readFile, WID, '/w/missing.md')).resolves.toBe(false)
    readFile.mockResolvedValueOnce({ kind: 'bytes', path: '/w/missing.md', data: 'x', mediaType: 'image/png' })
    await expect(openPathInEditor(instance, readFile, WID, '/w/missing.md')).resolves.toBe(false)
    expect(instance.store.getSnapshot().byWorkspace[WID]?.tabs ?? []).toEqual([])
  })
})
