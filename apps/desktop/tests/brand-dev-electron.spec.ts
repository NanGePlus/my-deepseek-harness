/**
 * Dev Electron bundle branding seam.
 */

import { describe, expect, it } from 'vitest'
import { DESKTOP_APP_DISPLAY_NAME } from '../src/app-branding.ts'

describe('brand-dev-electron seam', () => {
  it('targets NanGeAGI for macOS bundle plist keys', () => {
    expect(DESKTOP_APP_DISPLAY_NAME).toBe('NanGeAGI')
  })
})
