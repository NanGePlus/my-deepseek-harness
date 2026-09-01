/**
 * Desktop window.open / target=_blank routing seam.
 */

import { describe, expect, it } from 'vitest'
import { decideDesktopWindowOpen } from '../src/window-open-policy.ts'

describe('decideDesktopWindowOpen', () => {
  it('embeds http(s) URLs and denies a new window', () => {
    expect(decideDesktopWindowOpen('https://example.com/path')).toEqual({
      action: 'deny',
      embedUrl: 'https://example.com/path',
    })
    expect(decideDesktopWindowOpen('http://127.0.0.1:3080/')).toEqual({
      action: 'deny',
      embedUrl: 'http://127.0.0.1:3080/',
    })
  })

  it('denies non-http schemes without an embed URL', () => {
    expect(decideDesktopWindowOpen('about:blank')).toEqual({ action: 'deny' })
    expect(decideDesktopWindowOpen('file:///tmp/x')).toEqual({ action: 'deny' })
    expect(decideDesktopWindowOpen('javascript:alert(1)')).toEqual({ action: 'deny' })
    expect(decideDesktopWindowOpen('not a url')).toEqual({ action: 'deny' })
  })
})
