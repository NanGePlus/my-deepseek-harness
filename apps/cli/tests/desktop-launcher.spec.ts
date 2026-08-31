/**
 * `dsh desktop` argument parsing and launcher paths.
 */

import { describe, expect, it } from 'vitest'
import { parseDshArgs } from '../src/args.ts'
import { resolveDesktopMainEntry } from '../src/desktop-launcher.ts'

describe('dsh desktop launcher', () => {
  it('parses the desktop subcommand', () => {
    const invocation = parseDshArgs(['desktop'], '0.0.0-test')
    expect(invocation).toEqual({ mode: 'desktop', args: [] })
  })

  it('resolves the desktop Main entry under the repository', () => {
    expect(resolveDesktopMainEntry()).toMatch(/apps\/desktop\/(lib\/main\.js|src\/main\.ts)$/)
  })
})
