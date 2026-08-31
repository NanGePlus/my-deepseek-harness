/**
 * Desktop App icon seam (Issue #117 / US-10).
 */

import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveDesktopAppIconPath } from '../src/app-icon.ts'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

describe('desktop app icon seam', () => {
  it('resolves an existing icon asset for Dock / Taskbar branding', () => {
    const iconPath = resolveDesktopAppIconPath(repoRoot)
    expect(iconPath).toBeDefined()
    expect(existsSync(iconPath!)).toBe(true)
  })
})
