import { describe, expect, it, vi } from 'vitest'
import {
  measureBrowserOccupantBounds,
  readDesktopBrowserOccupantReporter,
  reportBrowserOccupantBounds,
} from '../src/client/browser-desktop-occupant.ts'

describe('browser-desktop-occupant', () => {
  it('readDesktopBrowserOccupantReporter returns undefined without desktop delivery', () => {
    vi.stubGlobal('dsh', undefined)
    expect(readDesktopBrowserOccupantReporter()).toBeUndefined()
  })

  it('readDesktopBrowserOccupantReporter returns the preload reporter', () => {
    const report = vi.fn()
    vi.stubGlobal('dsh', { delivery: 'desktop', reportBrowserOccupantBounds: report })
    readDesktopBrowserOccupantReporter()!({ x: 1, y: 2, width: 3, height: 4, visible: true })
    expect(report).toHaveBeenCalledWith({ x: 1, y: 2, width: 3, height: 4, visible: true })
  })

  it('measureBrowserOccupantBounds forces visible=false when the segment is hidden', () => {
    const element = { getBoundingClientRect: () => ({ x: 10, y: 20, width: 300, height: 200 }) } as HTMLElement
    expect(measureBrowserOccupantBounds(element, false)).toEqual({
      x: 0, y: 0, width: 0, height: 0, visible: false,
    })
  })

  it('reportBrowserOccupantBounds publishes detach when the segment is hidden', () => {
    const reporter = vi.fn()
    reportBrowserOccupantBounds(reporter, null, false)
    expect(reporter).toHaveBeenCalledWith({ x: 0, y: 0, width: 0, height: 0, visible: false })
  })
})
