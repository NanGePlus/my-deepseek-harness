import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { createDirtyGuard, resetDirtyGuardForTest } from '../src/client/dirty-guard.ts'

const S1 = 's1' as SessionId
const S2 = 's2' as SessionId
const TAB = { path: '/w/a.ts', name: 'a.ts' }

describe('dirty guard', () => {
  it('opens immediately when the session bridge is absent', () => {
    const guard = createDirtyGuard()
    const commit = vi.fn()
    guard.tryOpenSession(S1, S2, commit)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('opens immediately when there is no current session or no dirty tabs', () => {
    const guard = createDirtyGuard()
    const commit = vi.fn()
    guard.tryOpenSession(undefined, S1, commit)
    expect(commit).toHaveBeenCalledTimes(1)
    commit.mockClear()
    guard.registerBridge(S1, {
      dirtyTabs: () => [],
      saveTab: async () => true,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    guard.tryOpenSession(S1, S2, commit)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('processes a multi-tab session switch queue one file at a time', async () => {
    const guard = createDirtyGuard()
    const commit = vi.fn()
    const closeAllTabs = vi.fn()
    const saved: string[] = []
    guard.registerBridge(S1, {
      dirtyTabs: () => [TAB, { path: '/w/b.ts', name: 'b.ts' }],
      saveTab: async (path) => { saved.push(path); return true },
      discardTab: (path) => { saved.push(`discard:${path}`) },
      closeAllTabs,
    })
    guard.tryOpenSession(S1, S2, commit)
    expect(guard.getSnapshot().mode.kind).toBe('session-switch')
    await guard.saveCurrent()
    expect(saved).toEqual(['/w/a.ts', 'discard:/w/a.ts'])
    await guard.saveCurrent()
    expect(saved).toEqual(['/w/a.ts', 'discard:/w/a.ts', '/w/b.ts', 'discard:/w/b.ts'])
    expect(closeAllTabs).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(guard.getSnapshot().mode.kind).toBe('idle')
  })

  it('does not close a clean tab through the guard', () => {
    const guard = createDirtyGuard()
    guard.registerBridge(S1, {
      dirtyTabs: () => [],
      saveTab: async () => true,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    expect(guard.requestCloseTab(S1, '/w/clean.ts')).toBe(false)
  })

  it('cancel clears an active guard without committing', () => {
    const guard = createDirtyGuard()
    const commit = vi.fn()
    guard.registerBridge(S1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    guard.tryOpenSession(S1, S2, commit)
    guard.cancel()
    expect(guard.getSnapshot().mode.kind).toBe('idle')
    expect(commit).not.toHaveBeenCalled()
    guard.cancel()
  })

  it('notifies subscribers when the mode changes', () => {
    const guard = createDirtyGuard()
    const seen: string[] = []
    const unsub = guard.subscribe(() => { seen.push(guard.getSnapshot().mode.kind) })
    guard.registerBridge(S1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    guard.requestCloseTab(S1, TAB.path)
    unsub()
    expect(seen).toContain('close-tab')
  })

  it('skips guard when switching to the same session', () => {
    const guard = createDirtyGuard()
    const commit = vi.fn()
    guard.registerBridge(S1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    guard.tryOpenSession(S1, S1, commit)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(guard.getSnapshot().mode.kind).toBe('idle')
  })

  it('ignores save and discard when idle or the bridge is gone', async () => {
    const guard = createDirtyGuard()
    await guard.saveCurrent()
    guard.discardCurrent()
    const dispose = guard.registerBridge(S1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    guard.requestCloseTab(S1, TAB.path)
    dispose()
    await guard.saveCurrent()
    guard.discardCurrent()
  })

  it('returns false when no session bridge is registered', () => {
    const guard = createDirtyGuard()
    expect(guard.requestCloseTab(S1, TAB.path)).toBe(false)
  })

  it('records save failure without finishing the queue', async () => {
    const guard = createDirtyGuard()
    guard.registerBridge(S1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => false,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    guard.requestCloseTab(S1, TAB.path)
    await guard.saveCurrent()
    expect(guard.getSnapshot().mode.kind).toBe('close-tab')
    if (guard.getSnapshot().mode.kind === 'close-tab') {
      expect(guard.getSnapshot().mode.saveError).toBe('save-failed')
    }
  })

  it('resetDirtyGuardForTest clears an active guard', () => {
    const guard = createDirtyGuard()
    guard.registerBridge(S1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
      closeAllTabs: () => {},
    })
    guard.requestCloseTab(S1, TAB.path)
    resetDirtyGuardForTest(guard)
    expect(guard.getSnapshot().mode.kind).toBe('idle')
  })
})
