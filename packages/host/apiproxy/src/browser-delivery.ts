/**
 * Browser delivery mode hooks: web Playwright window vs desktop Electron CDP.
 * @module @deepseek-ai/dsh-host-apiproxy/browser-delivery
 */

import type { Page } from 'playwright'
import type { WorkspaceId } from './api/workspace.ts'

/** Host browser delivery shape. */
export type BrowserDelivery = 'web' | 'desktop'

/** Renderer request to focus the toolbox browser segment on one tab. */
export interface DesktopBrowserHumanRevealRequest {
  workspaceId: WorkspaceId
  tabId: string
  url: string
}

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
  /** Ask the Renderer to open the toolbox browser segment on one tab. */
  revealForHuman?(request: DesktopBrowserHumanRevealRequest): void
}

/** Shared across src and lib copies when Electron Main and Host boot resolve different entrypoints. */
const DESKTOP_SURFACE_GLOBAL = Symbol.for('@deepseek-ai/dsh-host-apiproxy.desktopSurface')

type DesktopSurfaceGlobal = Record<symbol, DesktopBrowserSurface | undefined>

let desktopSurface: DesktopBrowserSurface | undefined

function readGlobalDesktopSurface(): DesktopBrowserSurface | undefined {
  return (globalThis as DesktopSurfaceGlobal)[DESKTOP_SURFACE_GLOBAL]
}

function writeGlobalDesktopSurface(surface: DesktopBrowserSurface | undefined): void {
  (globalThis as DesktopSurfaceGlobal)[DESKTOP_SURFACE_GLOBAL] = surface
}

/** Register a Main-process hook that forwards human reveal to the Renderer. */
export function setDesktopBrowserHumanRevealListener(
  listener: ((request: DesktopBrowserHumanRevealRequest) => void) | undefined,
): void {
  setDesktopBrowserHumanRevealListenerImpl(listener)
}

let desktopBrowserHumanRevealListener: ((request: DesktopBrowserHumanRevealRequest) => void) | undefined

function setDesktopBrowserHumanRevealListenerImpl(
  listener: ((request: DesktopBrowserHumanRevealRequest) => void) | undefined,
): void {
  desktopBrowserHumanRevealListener = listener
}

/** Ask the desktop Renderer to open the toolbox browser segment on one tab. */
export function notifyDesktopBrowserHumanReveal(request: DesktopBrowserHumanRevealRequest): void {
  desktopBrowserHumanRevealListener?.(request)
}

/** Register the desktop BrowserView surface before integrated Host boot. */
export function setDesktopBrowserSurface(surface: DesktopBrowserSurface): void {
  desktopSurface = surface
  writeGlobalDesktopSurface(surface)
}

/** Clear the registered desktop surface (tests). */
export function resetDesktopBrowserSurface(): void {
  desktopSurface = undefined
  writeGlobalDesktopSurface(undefined)
  setDesktopBrowserHumanRevealListenerImpl(undefined)
}

/** The registered desktop surface, if any. */
export function getDesktopBrowserSurface(): DesktopBrowserSurface | undefined {
  return desktopSurface ?? readGlobalDesktopSurface()
}

/** Resolve the desktop surface or throw when desktop delivery is misconfigured. */
export function requireDesktopBrowserSurface(): DesktopBrowserSurface {
  const surface = desktopSurface
  if (surface === undefined) {
    throw new Error('desktop browser delivery requires a registered DesktopBrowserSurface')
  }
  return surface
}
