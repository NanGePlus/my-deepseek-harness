import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply as applyNode } from '../src/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { EditorSurface, type FileEditorDirtyGuardInjected, type FileEditorInjected } from '../src/client/EditorSurface.tsx'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  ctx.provide('locale', new LocaleRuntime(ctx))
  const workspaces = {
    listWorkspaceEntries: vi.fn(() => Promise.resolve({ path: '/w', entries: [], truncated: false })),
    gitStatus: vi.fn(() => Promise.resolve({ entries: [{ path: '/w/a.ts', letter: 'M' }] })),
    readFile: vi.fn(() => Promise.resolve({ kind: 'text' as const, path: '/w/a.ts', text: '' })),
    writeFile: vi.fn(() => Promise.resolve({ path: '/w/a.ts' })),
    deletePath: vi.fn(() => Promise.resolve({ path: '/w/a.ts' })),
    renamePath: vi.fn(() => Promise.resolve({ path: '/w/b.ts' })),
    createWorkspaceDirectory: vi.fn(() => Promise.resolve({ path: '/w/src' })),
    watchPath: vi.fn(),
  }
  ctx.provide('workspaces', workspaces)
  slots.register({
    name: 'root',
    children: { details: { kind: 'single', scope: 'session' } },
  } as never, () => null)
  return { ctx, slots, workspaces }
}

describe('ui-file-editor apply', () => {
  it('host half has no behavior', () => {
    applyNode()
  })

  it('registers the editor surface into the declared details child slot', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.editor': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('conversation.details.editor')[0]
    expect(entry?.component).toBe(EditorSurface)
    const face = entry?.inject?.() as unknown as FileEditorInjected & FileEditorDirtyGuardInjected
    await expect(face.listWorkspaceEntries('ws' as WorkspaceId, '/w')).resolves.toEqual({
      path: '/w', entries: [], truncated: false,
    })
    await expect(face.gitStatus('ws' as WorkspaceId)).resolves.toEqual({
      entries: [{ path: '/w/a.ts', letter: 'M' }],
    })
    expect(b.workspaces.listWorkspaceEntries).toHaveBeenCalledWith('ws', '/w', undefined)
    expect(b.workspaces.gitStatus).toHaveBeenCalledWith('ws', undefined)
    await expect(face.readFile('ws' as WorkspaceId, '/w/a.ts', 'text')).resolves.toEqual({
      kind: 'text', path: '/w/a.ts', text: '',
    })
    await expect(face.writeFile('ws' as WorkspaceId, '/w/a.ts', 'x')).resolves.toEqual({ path: '/w/a.ts' })
    expect(b.workspaces.readFile).toHaveBeenCalledWith('ws', '/w/a.ts', 'text', undefined)
    expect(b.workspaces.writeFile).toHaveBeenCalledWith('ws', '/w/a.ts', 'x', undefined)
    await expect(face.deletePath('ws' as WorkspaceId, '/w/a.ts')).resolves.toEqual({ path: '/w/a.ts' })
    await expect(face.renamePath('ws' as WorkspaceId, '/w/a.ts', 'b.ts')).resolves.toEqual({ path: '/w/b.ts' })
    await expect(face.createWorkspaceDirectory('ws' as WorkspaceId, '/w', 'src')).resolves.toEqual({ path: '/w/src' })
    expect(b.workspaces.deletePath).toHaveBeenCalledWith('ws', '/w/a.ts', undefined)
    expect(b.workspaces.renamePath).toHaveBeenCalledWith('ws', '/w/a.ts', 'b.ts', undefined)
    expect(b.workspaces.createWorkspaceDirectory).toHaveBeenCalledWith('ws', '/w', 'src', undefined)
    face.watchPath('ws' as WorkspaceId, '/w/a.ts', () => {}, undefined)
    expect(b.workspaces.watchPath).toHaveBeenCalledWith('ws', '/w/a.ts', expect.any(Function), undefined)
    expect(face.dirtyGuard).toBeDefined()
  })

  it('provides fileEditorOpen that reads through workspaces and writes editor tabs', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.editor': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const fileEditorOpen = b.ctx.get('fileEditorOpen')
    expect(fileEditorOpen).toBeDefined()
    await expect(fileEditorOpen!.openPath('ws' as WorkspaceId, '/w/readme.md')).resolves.toBe(true)
    expect(b.workspaces.readFile).toHaveBeenCalledWith('ws', '/w/readme.md', 'text', undefined)
    const instance = b.slots.sessionStore(
      b.slots.entries('conversation.details.editor')[0]!.store as never,
      '' as SessionId,
    )
    expect(instance.store.getSnapshot().byWorkspace['ws']?.activePath).toBe('/w/readme.md')
  })
})
