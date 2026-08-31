/**
 * Desktop SPA index.html composition seam.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildDesktopSpaIndexHtml } from '../src/spa-index.ts'

describe('desktop spa index seam', () => {
  let distRoot = ''

  afterEach(() => {
    if (distRoot !== '') rmSync(distRoot, { recursive: true, force: true })
    distRoot = ''
  })

  it('attach-host: omits failure wire when Host boot is skipped', () => {
    distRoot = mkdtempSync(join(tmpdir(), 'dsh-desktop-spa-attach-'))
    writeFileSync(join(distRoot, 'index.html'), '<html><head></head><body></body></html>')
    const html = buildDesktopSpaIndexHtml({
      distRoot,
      skipHostBoot: true,
      hostBooted: false,
      lastHostBootError: 'ignored',
    })
    expect(html).toContain('"ok":true')
    expect(html).not.toContain('ignored')
  })
})
