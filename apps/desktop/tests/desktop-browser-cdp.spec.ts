/**
 * Electron empty URL and Playwright about:blank are the same blank document.
 * Existing CDP pages must match before waitForEvent('page').
 */

import { describe, expect, it } from 'vitest'
import { findCdpPageByUrl, normalizeDesktopBrowserUrl } from '../src/desktop-browser-cdp.ts'

describe('normalizeDesktopBrowserUrl', () => {
  it('collapses empty Electron URL and about:blank', () => {
    expect(normalizeDesktopBrowserUrl('')).toBe('about:blank')
    expect(normalizeDesktopBrowserUrl('about:blank')).toBe('about:blank')
    expect(normalizeDesktopBrowserUrl('https://example.com/')).toBe('https://example.com/')
  })
})

describe('findCdpPageByUrl', () => {
  it('matches Playwright about:blank to Electron empty getURL', () => {
    const spa = { url: () => 'http://127.0.0.1:5173/' }
    const tab = { url: () => 'about:blank' }
    expect(findCdpPageByUrl([spa, tab], '')).toBe(tab)
    expect(findCdpPageByUrl([spa, tab], 'about:blank')).toBe(tab)
  })

  it('returns undefined when no page matches, so callers may waitForEvent', () => {
    const spa = { url: () => 'http://127.0.0.1:5173/' }
    expect(findCdpPageByUrl([spa], 'about:blank')).toBeUndefined()
    expect(findCdpPageByUrl([spa], 'https://example.com/')).toBeUndefined()
  })
})
