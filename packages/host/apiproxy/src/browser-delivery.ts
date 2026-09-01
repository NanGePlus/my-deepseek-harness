/**
 * Browser delivery mode hooks: web Playwright window vs desktop Electron CDP.
 * @module @deepseek-ai/dsh-host-apiproxy/browser-delivery
 */

import type { Page } from 'playwright'
import type { WorkspaceId } from './api/workspace.ts'

/** Host browser delivery shape. */
export type BrowserDelivery = 'web' | 'desktop'

/**
 * Main-process BrowserView seam for desktop delivery.
 * Electron Main registers one implementation before Host boot.
 */
export interface DesktopBrowserSurface {
  /** Playwright CDP endpoint for the embedded Electron browser (for example `http://127.0.0.1:9222`). */
  cdpEndpoint(): string
  /** Create or reuse the BrowserView webContents for one workspace tab. */
  ensureTab(workspaceId: WorkspaceId, tabId: string, url: string): Promise<void>
  /** Resolve the Playwright page backing one embedded tab after {@link ensureTab}. */
  pageForTab(workspaceId: WorkspaceId, tabId: string): Promise<Page>
  /** Raise the embedded tab for human viewing without an OS window. */
  selectTab(workspaceId: WorkspaceId, tabId: string): Promise<void>
  /** Drop the BrowserView for a closed tab before Playwright `page.close()`. */
  closeTab(workspaceId: WorkspaceId, tabId: string): Promise<void>
}

let desktopSurface: DesktopBrowserSurface | undefined

/** Register the desktop BrowserView surface before integrated Host boot. */
export function setDesktopBrowserSurface(surface: DesktopBrowserSurface): void {
  desktopSurface = surface
}

/** Clear the registered desktop surface (tests). */
export function resetDesktopBrowserSurface(): void {
  desktopSurface = undefined
}

/** The registered desktop surface, if any. */
export function getDesktopBrowserSurface(): DesktopBrowserSurface | undefined {
  return desktopSurface
}

/** Resolve the desktop surface or throw when desktop delivery is misconfigured. */
export function requireDesktopBrowserSurface(): DesktopBrowserSurface {
  const surface = desktopSurface
  if (surface === undefined) {
    throw new Error('desktop browser delivery requires a registered DesktopBrowserSurface')
  }
  return surface
}
