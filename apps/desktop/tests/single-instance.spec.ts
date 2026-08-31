/**
 * Single-instance lock + second-instance focus seam (Issue #117 / PRD 单实例与聚焦).
 */

import { describe, expect, it, vi } from 'vitest'
import { installSingleInstanceLock } from '../src/single-instance.ts'

describe('desktop single-instance seam', () => {
  it('quits immediately when the lock is not acquired', () => {
    const quit = vi.fn()
    const acquired = installSingleInstanceLock({
      requestSingleInstanceLock: () => false,
      onSecondInstance: () => {},
      quit,
    })
    expect(acquired).toBe(false)
    expect(quit).toHaveBeenCalledOnce()
  })

  it('registers second-instance focus without starting a second Host', () => {
    const quit = vi.fn()
    const focusMainWindow = vi.fn()
    let secondInstance: (() => void) | undefined
    const acquired = installSingleInstanceLock({
      requestSingleInstanceLock: () => true,
      onSecondInstance: (listener) => { secondInstance = listener },
      quit,
      focusMainWindow,
    })
    expect(acquired).toBe(true)
    expect(quit).not.toHaveBeenCalled()
    secondInstance?.()
    expect(focusMainWindow).toHaveBeenCalledOnce()
  })

  it('skips the lock in attach mode', () => {
    const quit = vi.fn()
    const acquired = installSingleInstanceLock({
      requestSingleInstanceLock: () => { throw new Error('should not request lock') },
      onSecondInstance: () => {},
      quit,
    }, { skip: true })
    expect(acquired).toBe(true)
    expect(quit).not.toHaveBeenCalled()
  })
})
