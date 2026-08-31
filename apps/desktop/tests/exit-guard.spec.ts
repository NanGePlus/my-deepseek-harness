/**
 * Main-process exit guard coordinator seam (Issue #117 / PRD 退出守卫).
 */

import { describe, expect, it, vi } from 'vitest'
import { createExitGuardCoordinator } from '../src/exit-guard.ts'

describe('desktop exit guard seam', () => {
  it('blocks quit until the renderer reports proceed=false', async () => {
    const sendExitRequest = vi.fn()
    const teardownHost = vi.fn()
    const coordinator = createExitGuardCoordinator({
      sendExitRequest,
      teardownHost,
      isAttachMode: () => false,
    })
    const decision = coordinator.requestQuit()
    expect(sendExitRequest).toHaveBeenCalledOnce()
    coordinator.handleExitGuardResult({ proceed: false })
    await expect(decision).resolves.toBe(false)
    expect(teardownHost).not.toHaveBeenCalled()
  })

  it('teardowns Host after the renderer discards dirty editors and proceeds', async () => {
    const teardownHost = vi.fn()
    const coordinator = createExitGuardCoordinator({
      sendExitRequest: () => {},
      teardownHost,
      isAttachMode: () => false,
    })
    const decision = coordinator.requestQuit()
    coordinator.handleExitGuardResult({ proceed: true })
    await expect(decision).resolves.toBe(true)
    expect(teardownHost).toHaveBeenCalledOnce()
  })

  it('skips Host teardown in attach mode while still exiting the GUI', async () => {
    const teardownHost = vi.fn()
    const coordinator = createExitGuardCoordinator({
      sendExitRequest: () => {},
      teardownHost,
      isAttachMode: () => true,
    })
    const decision = coordinator.requestQuit()
    coordinator.handleExitGuardResult({ proceed: true })
    await expect(decision).resolves.toBe(true)
    expect(teardownHost).not.toHaveBeenCalled()
  })
})
