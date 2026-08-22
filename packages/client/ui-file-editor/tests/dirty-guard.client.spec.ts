import { describe, expect, it } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { createDirtyGuard, resetDirtyGuardForTest } from '../src/client/dirty-guard.ts'

const W1 = 'ws1' as WorkspaceId
const W2 = 'ws2' as WorkspaceId
const TAB = { path: '/w/a.ts', name: 'a.ts' }

describe('dirty guard', () => {
  it('does not guard a clean tab close', () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [],
      saveTab: async () => true,
      discardTab: () => {},
    })
    expect(guard.requestCloseTab(W1, '/w/clean.ts')).toBe(false)
  })

  it('processes a dirty close queue one file at a time', async () => {
    const guard = createDirtyGuard()
    const saved: string[] = []
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB, { path: '/w/b.ts', name: 'b.ts' }],
      saveTab: async (path) => { saved.push(path); return true },
      discardTab: (path) => { saved.push(`discard:${path}`) },
    })
    expect(guard.requestCloseTab(W1, TAB.path)).toBe(true)
    expect(guard.getSnapshot().mode.kind).toBe('close-tab')
    await guard.saveCurrent()
    expect(saved).toEqual(['/w/a.ts', 'discard:/w/a.ts'])
    expect(guard.getSnapshot().mode.kind).toBe('idle')
    expect(guard.requestCloseTab(W1, '/w/b.ts')).toBe(true)
    await guard.discardCurrent()
    expect(saved).toEqual(['/w/a.ts', 'discard:/w/a.ts', 'discard:/w/b.ts'])
  })

  it('cancel clears an active guard', () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
    })
    guard.requestCloseTab(W1, TAB.path)
    guard.cancel()
    expect(guard.getSnapshot().mode.kind).toBe('idle')
    guard.cancel()
  })

  it('notifies subscribers when the mode changes', () => {
    const guard = createDirtyGuard()
    const seen: string[] = []
    const unsub = guard.subscribe(() => { seen.push(guard.getSnapshot().mode.kind) })
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
    })
    guard.requestCloseTab(W1, TAB.path)
    unsub()
    expect(seen).toContain('close-tab')
  })

  it('ignores save and discard when idle or the bridge is gone', async () => {
    const guard = createDirtyGuard()
    await guard.saveCurrent()
    guard.discardCurrent()
    const dispose = guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
    })
    guard.requestCloseTab(W1, TAB.path)
    dispose()
    await guard.saveCurrent()
    guard.discardCurrent()
  })

  it('returns false when no Workspace bridge is registered', () => {
    const guard = createDirtyGuard()
    expect(guard.requestCloseTab(W1, TAB.path)).toBe(false)
  })

  it('records save failure without finishing the queue', async () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => false,
      discardTab: () => {},
    })
    guard.requestCloseTab(W1, TAB.path)
    await guard.saveCurrent()
    const mode = guard.getSnapshot().mode
    expect(mode.kind).toBe('close-tab')
    if (mode.kind === 'close-tab') {
      expect(mode.saveError).toBe('save-failed')
    }
  })

  it('resetDirtyGuardForTest clears an active guard', () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
    })
    guard.requestCloseTab(W1, TAB.path)
    resetDirtyGuardForTest(guard)
    expect(guard.getSnapshot().mode.kind).toBe('idle')
  })

  it('scopes close-tab guards to the requesting Workspace', () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
    })
    guard.registerBridge(W2, {
      dirtyTabs: () => [],
      saveTab: async () => true,
      discardTab: () => {},
    })
    guard.requestCloseTab(W1, TAB.path)
    expect(guard.getSnapshot().mode).toMatchObject({ kind: 'close-tab', workspaceId: W1 })
    expect(guard.requestCloseTab(W2, TAB.path)).toBe(false)
  })

  it('queues every dirty bulk-close target in tab-bar order', () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB, { path: '/w/b.ts', name: 'b.ts' }],
      saveTab: async () => true,
      discardTab: () => {},
    })
    expect(guard.requestCloseTabs(W1, ['/w/a.ts', '/w/b.ts', '/w/c.ts'])).toBe(true)
    expect(guard.getSnapshot().mode).toMatchObject({
      kind: 'close-tab',
      queue: [TAB, { path: '/w/b.ts', name: 'b.ts' }],
    })
    expect(guard.requestCloseTabs(W1, ['/w/c.ts'])).toBe(false)
  })
})
