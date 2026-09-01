import { describe, expect, it } from 'vitest'
import { planEmbeddedBrowserOpen } from '../src/client/embedded-browser-open.ts'

describe('planEmbeddedBrowserOpen', () => {
  it('navigates the selected blank tab', () => {
    expect(planEmbeddedBrowserOpen('https://example.com', {
      tabId: 'tab-1',
      url: 'about:blank',
    })).toEqual({
      kind: 'navigate',
      url: 'https://example.com/',
      tabId: 'tab-1',
    })
  })

  it('creates a tab when the selected tab already has a document', () => {
    expect(planEmbeddedBrowserOpen('http://127.0.0.1:3080/', {
      tabId: 'tab-1',
      url: 'https://example.com/',
    })).toEqual({
      kind: 'create',
      url: 'http://127.0.0.1:3080/',
    })
  })

  it('creates a tab when none is selected', () => {
    expect(planEmbeddedBrowserOpen('https://example.com/x', undefined)).toEqual({
      kind: 'create',
      url: 'https://example.com/x',
    })
  })

  it('ignores non-http URLs', () => {
    expect(planEmbeddedBrowserOpen('javascript:alert(1)', undefined)).toEqual({ kind: 'none' })
    expect(planEmbeddedBrowserOpen('not a url', undefined)).toEqual({ kind: 'none' })
  })
})
