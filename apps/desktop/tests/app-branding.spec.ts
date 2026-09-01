/**
 * Desktop shell display name seam.
 */

import { describe, expect, it } from 'vitest'
import { DESKTOP_APP_ABOUT_DETAIL, DESKTOP_APP_DISPLAY_NAME } from '../src/app-branding.ts'

describe('desktop app branding seam', () => {
  it('uses NanGeAGI for the menu bar and packaged app name', () => {
    expect(DESKTOP_APP_DISPLAY_NAME).toBe('NanGeAGI')
    expect(DESKTOP_APP_ABOUT_DETAIL).toContain('NanGeAGI')
  })
})
