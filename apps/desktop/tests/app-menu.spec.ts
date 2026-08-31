/**
 * Application menu seam (Issue #117 / PRD 标准壳应用菜单).
 */

import { describe, expect, it, vi } from 'vitest'
import { buildApplicationMenuTemplate } from '../src/app-menu.ts'

describe('desktop application menu seam', () => {
  it('exposes About, Settings, and Quit actions', () => {
    const showAbout = vi.fn()
    const focusSettings = vi.fn()
    const requestQuit = vi.fn()
    const template = buildApplicationMenuTemplate({
      appName: 'DeepSeek Harness',
      version: '1.2.3',
      showAbout,
      focusSettings,
      requestQuit,
    })
    const appMenu = template[0]
    expect(appMenu?.label).toBe('DeepSeek Harness')
    const items = (appMenu?.submenu as Array<{ label?: string; click?: () => void }> | undefined)
      ?.filter(item => item.label !== undefined)
    expect(items?.map(item => item.label)).toEqual(['About DeepSeek Harness', 'Settings…', 'Quit'])
    items?.[0]?.click?.()
    items?.[1]?.click?.()
    items?.[2]?.click?.()
    expect(showAbout).toHaveBeenCalledOnce()
    expect(focusSettings).toHaveBeenCalledOnce()
    expect(requestQuit).toHaveBeenCalledOnce()
  })
})
