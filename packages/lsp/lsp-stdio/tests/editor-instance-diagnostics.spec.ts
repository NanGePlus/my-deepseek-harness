import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DIAGNOSTICS_SETTLE_MS } from '../src/editor-instance.ts'
import {
  readPublishDiagnosticsVersion,
  shouldApplyPublishedDiagnostics,
  shouldUpdateDiagnosticsCache,
} from '../src/diagnostics.ts'

describe('editor LSP diagnostics settle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for publishDiagnostics to settle before treating the batch as final', async () => {
    type Waiter = { expectedVersion: number; resolve: (value: string) => void }
    const waiters: Waiter[] = []
    let cache = ''
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    let token = 0

    const scheduleSettle = (publishedVersion: number | undefined): void => {
      if (waiters.length === 0) return
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      token += 1
      const current = token
      settleTimer = setTimeout(() => {
        if (token !== current) return
        settleTimer = undefined
        const remaining: Waiter[] = []
        for (const waiter of waiters) {
          if (shouldApplyPublishedDiagnostics(publishedVersion, waiter.expectedVersion)) {
            waiter.resolve(cache)
          } else {
            remaining.push(waiter)
          }
        }
        waiters.length = 0
        waiters.push(...remaining)
      }, DIAGNOSTICS_SETTLE_MS)
    }

    const publish = (version: number | undefined, label: string): void => {
      if (!shouldUpdateDiagnosticsCache(version, 2)) return
      cache = label
      scheduleSettle(version)
    }

    const pending = new Promise<string>((resolve) => {
      waiters.push({ expectedVersion: 2, resolve })
    })

    publish(2, 'stale')
    await vi.advanceTimersByTimeAsync(DIAGNOSTICS_SETTLE_MS - 1)
    publish(2, 'final')
    await vi.advanceTimersByTimeAsync(DIAGNOSTICS_SETTLE_MS)

    await expect(pending).resolves.toBe('final')
    expect(readPublishDiagnosticsVersion({ version: 2 })).toBe(2)
  })
})
