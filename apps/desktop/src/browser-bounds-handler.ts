/**
 * Browser occupant bounds IPC parsing and handler (no Electron import).
 * @module @deepseek-ai/dsh-desktop-shell/browser-bounds-handler
 */

import type { DesktopBrowserViewManager } from './browser-view-manager.ts'
import type { BrowserOccupantBounds } from './browser-view-bounds.ts'

/** Parsed occupant bounds payload from Renderer IPC. */
export function parseBrowserOccupantBounds(payload: unknown): BrowserOccupantBounds | undefined {
  if (payload === null || typeof payload !== 'object') return undefined
  const candidate = payload as Record<string, unknown>
  if (
    typeof candidate.x !== 'number'
    || typeof candidate.y !== 'number'
    || typeof candidate.width !== 'number'
    || typeof candidate.height !== 'number'
    || typeof candidate.visible !== 'boolean'
  ) return undefined
  return {
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
    visible: candidate.visible,
  }
}

/**
 * Build one occupant-bounds IPC handler for tests or Main registration.
 * @param manager - BrowserView manager receiving bounds updates.
 */
export function createBrowserBoundsHandler(
  manager: Pick<DesktopBrowserViewManager, 'applyOccupantBounds'>,
): (_event: unknown, payload: unknown) => void {
  return (_event: unknown, payload: unknown): void => {
    const bounds = parseBrowserOccupantBounds(payload)
    if (bounds === undefined) return
    try {
      manager.applyOccupantBounds(bounds)
    } catch (error: unknown) {
      // Occupant ResizeObserver ticks must not take down Main. Electron throws
      // when addBrowserView runs against a WebContentsView whose native view is gone.
      console.error('desktop: browser occupant bounds apply failed:', error)
    }
  }
}
