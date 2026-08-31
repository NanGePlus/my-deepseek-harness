/**
 * IPC registration for toolbox browser occupant bounds (Issue #118).
 * @module @deepseek-ai/dsh-desktop-shell/browser-bounds-ipc
 */

import { ipcMain } from 'electron'
import { createBrowserBoundsHandler } from './browser-bounds-handler.ts'
import { IPC_BROWSER_OCCUPANT_BOUNDS } from './ipc-contract.ts'
import type { DesktopBrowserViewManager } from './browser-view-manager.ts'

export { parseBrowserOccupantBounds, createBrowserBoundsHandler } from './browser-bounds-handler.ts'

/**
 * Register the browser occupant bounds IPC handler.
 * @param manager - BrowserView manager receiving bounds updates.
 * @returns disposer removing the handler.
 */
export function registerBrowserBoundsIpc(manager: DesktopBrowserViewManager): () => void {
  const handler = createBrowserBoundsHandler(manager)
  ipcMain.on(IPC_BROWSER_OCCUPANT_BOUNDS, handler)
  return () => { ipcMain.removeListener(IPC_BROWSER_OCCUPANT_BOUNDS, handler) }
}
