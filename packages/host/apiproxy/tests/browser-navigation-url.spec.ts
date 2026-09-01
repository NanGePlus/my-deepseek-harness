import { describe, expect, it } from 'vitest'
import { BrowserNavigationFailedError, isChromiumInternalErrorUrl } from '../src/browser-navigation-url.ts'

describe('isChromiumInternalErrorUrl', () => {
  it('detects Chromium net-error documents', () => {
    expect(isChromiumInternalErrorUrl('chrome-error://chromewebdata/')).toBe(true)
    expect(isChromiumInternalErrorUrl('https://example.com/')).toBe(false)
  })
})

describe('BrowserNavigationFailedError', () => {
  it('names the requested URL in the message', () => {
    const error = new BrowserNavigationFailedError('http://127.0.0.1:3080/')
    expect(error.requestedUrl).toBe('http://127.0.0.1:3080/')
    expect(error.message).toBe('Failed to load http://127.0.0.1:3080/')
  })
})
