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
 * Build the application menu. Includes the platform Edit menu with clipboard
 * roles only: a full {@link role} `editMenu` also registers Undo/Redo
 * accelerators that call `webContents.undo()`, which bypasses Monaco and
 * TipTap document undo (CJK IME preedit shows romanization instead of reverting).
 * @param actions - menu callbacks.
 * @returns Electron menu template.
 */
export function buildApplicationMenuTemplate(
  actions: ApplicationMenuActions,
): MenuItemConstructorOptions[] {
  const editSubmenu: MenuItemConstructorOptions[] = [
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    ...(process.platform === 'darwin'
      ? [
        { role: 'pasteAndMatchStyle' as const },
        { role: 'delete' as const },
        { role: 'selectAll' as const },
      ]
      : [
        { role: 'delete' as const },
        { type: 'separator' as const },
        { role: 'selectAll' as const },
      ]),
  ]
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
  }, { role: 'editMenu', submenu: editSubmenu }]
}
