/**
 * Application menu seam (Issue #117 / PRD 标准壳应用菜单).
 */

import { describe, expect, it, vi } from 'vitest'
import { DESKTOP_APP_DISPLAY_NAME } from '../src/app-branding.ts'
import { buildApplicationMenuTemplate } from '../src/app-menu.ts'

describe('desktop application menu seam', () => {
  it('exposes About, Settings, and Quit actions', () => {
    const showAbout = vi.fn()
    const focusSettings = vi.fn()
    const requestQuit = vi.fn()
    const template = buildApplicationMenuTemplate({
      appName: DESKTOP_APP_DISPLAY_NAME,
      version: '1.2.3',
      showAbout,
      focusSettings,
      requestQuit,
    })
    const appMenu = template[0]
    expect(appMenu?.label).toBe('NanGeAGI')
    const items = (appMenu?.submenu as Array<{ label?: string; click?: () => void }> | undefined)
      ?.filter(item => item.label !== undefined)
    expect(items?.map(item => item.label)).toEqual(['About NanGeAGI', 'Settings…', 'Quit'])
    items?.[0]?.click?.()
    items?.[1]?.click?.()
    items?.[2]?.click?.()
    expect(showAbout).toHaveBeenCalledOnce()
    expect(focusSettings).toHaveBeenCalledOnce()
    expect(requestQuit).toHaveBeenCalledOnce()
  })

  it('keeps clipboard Edit roles without native undo/redo accelerators', () => {
    const template = buildApplicationMenuTemplate({
      appName: DESKTOP_APP_DISPLAY_NAME,
      version: '1.2.3',
      showAbout: () => undefined,
      focusSettings: () => undefined,
      requestQuit: () => undefined,
    })
    const editMenu = template.find(item => item.role === 'editMenu')
    expect(editMenu).toBeDefined()
    const submenu = editMenu?.submenu as Array<{ role?: string }> | undefined
    expect(submenu?.some(item => item.role === 'copy')).toBe(true)
    expect(submenu?.some(item => item.role === 'paste')).toBe(true)
    expect(submenu?.some(item => item.role === 'undo')).toBe(false)
    expect(submenu?.some(item => item.role === 'redo')).toBe(false)
  })
})
