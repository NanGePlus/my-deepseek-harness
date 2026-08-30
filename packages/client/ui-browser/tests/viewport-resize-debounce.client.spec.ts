// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  createViewportResizeDebouncer, readViewportContentSize, VIEWPORT_RESIZE_DEBOUNCE_MS,
} from '../src/client/viewport-resize-debounce.ts'

describe('viewport resize debounce', () => {
  it('debounces successive arms before invoking resize', () => {
    vi.useFakeTimers()
    const onResize = vi.fn()
    const debouncer = createViewportResizeDebouncer(onResize, 150, {
      schedule: (fn, delayMs) => setTimeout(fn, delayMs),
      cancel: (handle) => { clearTimeout(handle) },
    })
    debouncer.arm()
    debouncer.arm()
    expect(onResize).not.toHaveBeenCalled()
    vi.advanceTimersByTime(VIEWPORT_RESIZE_DEBOUNCE_MS - 1)
    expect(onResize).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onResize).toHaveBeenCalledTimes(1)
    debouncer.dispose()
    vi.useRealTimers()
  })

  it('returns null for zero-sized hosts', () => {
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 0 })
    Object.defineProperty(host, 'clientHeight', { value: 0 })
    expect(readViewportContentSize(host)).toBeNull()
  })

  it('returns floored pixel dimensions for visible hosts', () => {
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 640.9 })
    Object.defineProperty(host, 'clientHeight', { value: 480.2 })
    expect(readViewportContentSize(host)).toEqual({ width: 640, height: 480 })
  })
})
