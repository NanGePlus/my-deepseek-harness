import { describe, expect, it } from 'vitest'
import { browserTabDisplayTitle } from '../src/client/browser-tab-title.ts'

describe('browserTabDisplayTitle', () => {
  it('prefers a non-blank document title', () => {
    expect(browserTabDisplayTitle({ title: '  Docs  ', url: 'https://example.com/docs' })).toBe('Docs')
  })

  it('falls back to the raw URL when parsing fails', () => {
    expect(browserTabDisplayTitle({ title: '', url: 'not-a-url' })).toBe('not-a-url')
  })

  it('falls back to the URL host name when the document title is blank', () => {
    expect(browserTabDisplayTitle({ title: '', url: 'https://example.com/docs' })).toBe('example.com')
  })
})
