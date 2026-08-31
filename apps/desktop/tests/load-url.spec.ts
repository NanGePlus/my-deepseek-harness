/**
 * Attach mode + renderer load URL resolution.
 */

import { describe, expect, it } from 'vitest'
import { readDesktopAttachConfig, shouldSkipHostBoot } from '../src/attach.ts'
import { DEFAULT_DESKTOP_DEV_URL, resolveDesktopLoadTarget } from '../src/load-url.ts'
import { productionSpaUrl } from '../src/protocol-dsh.ts'

describe('desktop attach mode', () => {
  it('enables attach mode from DSH_DESKTOP_ATTACH', () => {
    expect(readDesktopAttachConfig({ DSH_DESKTOP_ATTACH: 'http://127.0.0.1:8787' })).toEqual({
      webUrl: 'http://127.0.0.1:8787',
    })
    expect(shouldSkipHostBoot({ DSH_DESKTOP_ATTACH: 'http://127.0.0.1:8787' })).toBe(true)
  })

  it('skips integrated Host boot when attach is unset', () => {
    expect(shouldSkipHostBoot({})).toBe(false)
  })
})

describe('desktop load URL resolution', () => {
  it('loads production dsh:// dist by default', () => {
    expect(resolveDesktopLoadTarget({})).toEqual({
      url: productionSpaUrl(),
      dev: false,
      attach: false,
    })
  })

  it('loads Vite dev server URL in dev:desktop', () => {
    expect(resolveDesktopLoadTarget({ DSH_DESKTOP_DEV_URL: DEFAULT_DESKTOP_DEV_URL })).toEqual({
      url: DEFAULT_DESKTOP_DEV_URL,
      dev: true,
      attach: false,
    })
  })

  it('loads attach Host URL when DSH_DESKTOP_ATTACH is set', () => {
    expect(resolveDesktopLoadTarget({ DSH_DESKTOP_ATTACH: 'http://127.0.0.1:8787/' })).toEqual({
      url: 'http://127.0.0.1:8787/',
      dev: false,
      attach: true,
    })
  })
})
