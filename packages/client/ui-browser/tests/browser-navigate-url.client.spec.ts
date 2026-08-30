import { describe, expect, it } from 'vitest'
import { isExternalBrowserUrl, isLocalhostBrowserUrl, browserUrlHost, normalizeBrowserNavigateUrl } from '../src/client/browser-navigate-url.ts'

describe('normalizeBrowserNavigateUrl', () => {
  it('accepts explicit http and https URLs', () => {
    expect(normalizeBrowserNavigateUrl('https://example.com/path')).toBe('https://example.com/path')
    expect(normalizeBrowserNavigateUrl('http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173/')
  })

  it('prepends http for localhost-like hosts and https for other bare hosts', () => {
    expect(normalizeBrowserNavigateUrl('localhost:5173')).toBe('http://localhost:5173/')
    expect(normalizeBrowserNavigateUrl('example.com/docs')).toBe('https://example.com/docs')
  })

  it('rejects unsupported schemes and blank input', () => {
    expect(normalizeBrowserNavigateUrl('file:///tmp/a.html')).toBeUndefined()
    expect(normalizeBrowserNavigateUrl('   ')).toBeUndefined()
  })
})

describe('isExternalBrowserUrl', () => {
  it('allows http(s) and rejects about:blank', () => {
    expect(isExternalBrowserUrl('https://example.com')).toBe(true)
    expect(isExternalBrowserUrl('about:blank')).toBe(false)
  })
})

describe('isLocalhostBrowserUrl', () => {
  it('treats localhost-like hosts as local', () => {
    expect(isLocalhostBrowserUrl('http://127.0.0.1:5173/')).toBe(true)
    expect(isLocalhostBrowserUrl('http://localhost:3000/')).toBe(true)
    expect(isLocalhostBrowserUrl('http://[::1]:8080/')).toBe(true)
    expect(isLocalhostBrowserUrl('https://example.com/')).toBe(false)
    expect(isLocalhostBrowserUrl('about:blank')).toBe(true)
    expect(isLocalhostBrowserUrl('not-a-url')).toBe(true)
  })
})

describe('browserUrlHost', () => {
  it('returns a lowercase host for http(s) URLs', () => {
    expect(browserUrlHost('https://Example.COM/path')).toBe('example.com')
    expect(browserUrlHost('about:blank')).toBeUndefined()
  })
})
