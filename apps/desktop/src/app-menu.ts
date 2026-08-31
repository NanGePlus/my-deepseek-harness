/**
 * Standard shell application menu template.
 * @module @deepseek-ai/dsh-desktop-shell/app-menu
 */

import type { MenuItemConstructorOptions } from 'electron'

/** Callbacks wired by Main when installing the menu. */
export interface ApplicationMenuActions {
  appName: string
  version: string
  showAbout: () => void
  focusSettings: () => void
  requestQuit: () => void
}

/**
 * Build the macOS-style application menu (also used on Windows as the app menu).
 * @param actions - menu callbacks.
 * @returns Electron menu template.
 */
export function buildApplicationMenuTemplate(
  actions: ApplicationMenuActions,
): MenuItemConstructorOptions[] {
  return [{
    label: actions.appName,
    submenu: [
      {
        label: `About ${actions.appName}`,
        click: () => { actions.showAbout() },
      },
      { type: 'separator' },
      {
        label: 'Settings…',
        accelerator: 'CommandOrControl+,',
        click: () => { actions.focusSettings() },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click: () => { actions.requestQuit() },
      },
    ],
  }]
}
