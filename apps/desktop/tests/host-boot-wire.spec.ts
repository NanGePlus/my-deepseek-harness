/**
 * Host boot failure wire injection seam.
 */

import { describe, expect, it } from 'vitest'
import { hostBootFailureWire, injectHostBootWire } from '../src/host-boot-wire.ts'

describe('host boot failure wire', () => {
  it('injects __DSH_HOST_BOOT__ loud error payload into index.html', () => {
    const html = '<html><head></head><body></body></html>'
    const wired = injectHostBootWire(html, hostBootFailureWire('boom'))
    expect(wired).toContain('window.__DSH_HOST_BOOT__')
    expect(wired).toContain('"ok":false')
    expect(wired).toContain('boom')
  })
})
