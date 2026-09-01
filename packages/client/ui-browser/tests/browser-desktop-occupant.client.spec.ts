import { describe, expect, it, vi } from 'vitest'
import {
  insetOccupantBoundsForOverlay,
  measureBrowserOccupantBounds,
  openDesktopExternalUrl,
  readDesktopBrowserOccupantReporter,
  reportBrowserOccupantBounds,
  subscribeDesktopEmbeddedBrowserOpen,
} from '../src/client/browser-desktop-occupant.ts'

describe('browser-desktop-occupant', () => {
  it('readDesktopBrowserOccupantReporter returns undefined without desktop delivery', () => {
    vi.stubGlobal('dsh', undefined)
    expect(readDesktopBrowserOccupantReporter()).toBeUndefined()
  })

  it('readDesktopBrowserOccupantReporter returns undefined without integrated IPC fetch', () => {
    vi.stubGlobal('dsh', { delivery: 'desktop', reportBrowserOccupantBounds: vi.fn() })
    expect(readDesktopBrowserOccupantReporter()).toBeUndefined()
  })

  it('readDesktopBrowserOccupantReporter returns the preload reporter', () => {
    const report = vi.fn()
    vi.stubGlobal('dsh', {
      delivery: 'desktop',
      fetch: vi.fn(),
      reportBrowserOccupantBounds: report,
    })
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

  it('insetOccupantBoundsForOverlay keeps full bounds when the overlay does not intersect', () => {
    const bounds = { x: 10, y: 100, width: 400, height: 300, visible: true }
    expect(insetOccupantBoundsForOverlay(bounds, {
      top: 10, bottom: 80, left: 10, right: 200,
    })).toEqual(bounds)
  })

  it('insetOccupantBoundsForOverlay raises occupant y to the overlay bottom', () => {
    expect(insetOccupantBoundsForOverlay(
      { x: 10, y: 100, width: 400, height: 300, visible: true },
      { top: 80, bottom: 180, left: 300, right: 500 },
    )).toEqual({ x: 10, y: 180, width: 400, height: 220, visible: true })
  })

  it('reportBrowserOccupantBounds publishes full occupant bounds', () => {
    const reporter = vi.fn()
    const element = {
      getBoundingClientRect: () => ({ x: 10, y: 100, width: 400, height: 300 }),
    } as HTMLElement
    reportBrowserOccupantBounds(reporter, element, true)
    expect(reporter).toHaveBeenCalledWith({
      x: 10, y: 100, width: 400, height: 300, visible: true,
    })
  })

  it('subscribeDesktopEmbeddedBrowserOpen no-ops without desktop delivery', () => {
    vi.stubGlobal('dsh', undefined)
    expect(subscribeDesktopEmbeddedBrowserOpen(() => {})).toBeUndefined()
    expect(openDesktopExternalUrl('https://example.com')).toBeUndefined()
  })

  it('subscribeDesktopEmbeddedBrowserOpen forwards preload popups', () => {
    const listener = vi.fn()
    const unsubscribe = vi.fn()
    vi.stubGlobal('dsh', {
      delivery: 'desktop',
      onOpenEmbeddedBrowser: (next: (url: string) => void) => {
        next('https://example.com')
        return unsubscribe
      },
    })
    expect(subscribeDesktopEmbeddedBrowserOpen(listener)).toBe(unsubscribe)
    expect(listener).toHaveBeenCalledWith('https://example.com')
  })

  it('openDesktopExternalUrl forwards preload', async () => {
    const openExternalUrl = vi.fn(async () => ({ opened: true }))
    vi.stubGlobal('dsh', { delivery: 'desktop', openExternalUrl })
    await expect(openDesktopExternalUrl('https://example.com')).resolves.toEqual({ opened: true })
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com')
  })
})
