// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { createDirtyGuard } from '../src/client/dirty-guard.ts'
import { wireDesktopExitGuard } from '../src/client/desktop-shell.ts'

const W1 = 'ws1' as WorkspaceId
const TAB = { path: '/w/a.ts', name: 'a.ts' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('desktop shell preload exit guard seam', () => {
  it('no-ops when desktop preload bridge is absent', () => {
    const guard = createDirtyGuard()
    expect(wireDesktopExitGuard(guard)).toEqual(expect.any(Function))
  })

  it('exit-guard: reports proceed=false when dirty exit is cancelled', async () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
    })
    const sent: { proceed: boolean }[] = []
    vi.stubGlobal('dsh', {
      onExitRequest: (listener: () => void) => {
        listener()
        return () => {}
      },
      sendExitGuardResult: (result: { proceed: boolean }) => { sent.push(result) },
    })
    wireDesktopExitGuard(guard)
    await Promise.resolve()
    guard.cancel()
    await Promise.resolve()
    expect(sent).toEqual([{ proceed: false }])
  })

  it('exit-guard: reports proceed=true when no dirty editors remain', async () => {
    const guard = createDirtyGuard()
    const sent: { proceed: boolean }[] = []
    vi.stubGlobal('dsh', {
      onExitRequest: (listener: () => void) => {
        listener()
        return () => {}
      },
      sendExitGuardResult: (result: { proceed: boolean }) => { sent.push(result) },
    })
    wireDesktopExitGuard(guard)
    await Promise.resolve()
    expect(sent).toEqual([{ proceed: true }])
  })

  it('exit-guard: reports proceed=true after dirty editors are discarded', async () => {
    const guard = createDirtyGuard()
    guard.registerBridge(W1, {
      dirtyTabs: () => [TAB],
      saveTab: async () => true,
      discardTab: () => {},
    })
    const sent: { proceed: boolean }[] = []
    vi.stubGlobal('dsh', {
      onExitRequest: (listener: () => void) => {
        listener()
        return () => {}
      },
      sendExitGuardResult: (result: { proceed: boolean }) => { sent.push(result) },
    })
    wireDesktopExitGuard(guard)
    await Promise.resolve()
    guard.discardCurrent()
    await Promise.resolve()
    expect(sent).toEqual([{ proceed: true }])
  })
})
