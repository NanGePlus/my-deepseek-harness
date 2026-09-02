/**
 * Desktop delivery occupant bounds bridge for panel内 WebView.
 * @module @deepseek-ai/dsh-client-ui-browser/client/browser-desktop-occupant
 */

/** Screen-space rectangle reported to Main for BrowserView placement. */
export interface BrowserOccupantBounds {
  x: number
  y: number
  width: number
  height: number
  /** When false, Main detaches the BrowserView. */
  visible: boolean
}

/** Screen-space rectangle of chrome that must not sit under BrowserView. */
export interface BrowserOccupantOverlay {
  top: number
  bottom: number
  left: number
  right: number
}

/** Preload callback forwarding occupant bounds to Main IPC. */
export type BrowserOccupantBoundsReporter = (bounds: BrowserOccupantBounds) => void

/** Main request to focus the toolbox browser segment on one Host tab. */
export interface DesktopToolboxBrowserRevealRequest {
  workspaceId: string
  tabId: string
  url: string
}

type DshDesktopShell = {
  delivery?: string
  fetch?: (request: unknown) => Promise<unknown>
  reportBrowserOccupantBounds?: BrowserOccupantBoundsReporter
  onOpenEmbeddedBrowser?: (listener: (url: string) => void) => () => void
  onRevealToolboxBrowser?: (listener: (request: DesktopToolboxBrowserRevealRequest) => void) => () => void
  openExternalUrl?: (url: string) => Promise<{ opened: boolean }>
}

/**
 * Read the desktop occupant bounds reporter when integrated delivery exposes it.
 * @returns the reporter or undefined in browser / attach-without-bounds contexts.
 */
export function readDesktopBrowserOccupantReporter(): BrowserOccupantBoundsReporter | undefined {
  const bridge = (globalThis as { dsh?: DshDesktopShell }).dsh
  if (bridge?.delivery !== 'desktop') return undefined
  if (typeof bridge.fetch !== 'function') return undefined
  if (typeof bridge.reportBrowserOccupantBounds !== 'function') return undefined
  const report = bridge.reportBrowserOccupantBounds
  return (bounds: BrowserOccupantBounds) => { report(bounds) }
}

/**
 * Subscribe to Main-routed http(s) popups for the toolbox browser.
 * @returns disposer, or undefined when the desktop preload is absent.
 */
export function subscribeDesktopEmbeddedBrowserOpen(
  listener: (url: string) => void,
): (() => void) | undefined {
  const bridge = (globalThis as { dsh?: DshDesktopShell }).dsh
  if (bridge?.delivery !== 'desktop') return undefined
  if (typeof bridge.onOpenEmbeddedBrowser !== 'function') return undefined
  return bridge.onOpenEmbeddedBrowser(listener)
}

/**
 * Subscribe to Host-driven requests to focus the toolbox browser segment.
 * @returns disposer, or undefined when the integrated desktop preload is absent.
 */
export function subscribeDesktopToolboxBrowserReveal(
  listener: (request: DesktopToolboxBrowserRevealRequest) => void,
): (() => void) | undefined {
  const bridge = (globalThis as { dsh?: DshDesktopShell }).dsh
  if (bridge?.delivery !== 'desktop') return undefined
  if (typeof bridge.onRevealToolboxBrowser !== 'function') return undefined
  return bridge.onRevealToolboxBrowser(listener)
}

/**
 * Open one http(s) URL in the system browser via Main (explicit toolbar action).
 * @param url - live tab URL.
 * @returns whether Main accepted the URL, or undefined when preload is absent.
 */
export function openDesktopExternalUrl(url: string): Promise<{ opened: boolean }> | undefined {
  const bridge = (globalThis as { dsh?: DshDesktopShell }).dsh
  if (bridge?.delivery !== 'desktop') return undefined
  if (typeof bridge.openExternalUrl !== 'function') return undefined
  return bridge.openExternalUrl(url)
}

/**
 * Measure one occupant element in screen coordinates.
 * @param element - the `#browser-occupant` host element.
 * @param segmentVisible - whether the toolbox browser segment is selected.
 */
export function measureBrowserOccupantBounds(
  element: HTMLElement,
  segmentVisible: boolean,
): BrowserOccupantBounds {
  if (!segmentVisible) {
    return { x: 0, y: 0, width: 0, height: 0, visible: false }
  }
  const rect = element.getBoundingClientRect()
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    visible: rect.width > 0 && rect.height > 0,
  }
}

/**
 * Shrink occupant bounds so a chrome overlay is no longer covered by BrowserView.
 * Insets from the top: dropdowns hang from the tab/nav bar into the occupant.
 * @param bounds - measured `#browser-occupant` rectangle.
 * @param overlay - open portal menu rectangle, or null when chrome has no overlay.
 */
export function insetOccupantBoundsForOverlay(
  bounds: BrowserOccupantBounds,
  overlay: BrowserOccupantOverlay | null,
): BrowserOccupantBounds {
  if (!bounds.visible || overlay === null) return bounds
  const occupantBottom = bounds.y + bounds.height
  const occupantRight = bounds.x + bounds.width
  const overlaps = overlay.bottom > bounds.y
    && overlay.top < occupantBottom
    && overlay.right > bounds.x
    && overlay.left < occupantRight
  if (!overlaps) return bounds
  const y = Math.max(bounds.y, overlay.bottom)
  const height = occupantBottom - y
  if (height <= 0) return { x: 0, y: 0, width: 0, height: 0, visible: false }
  return { x: bounds.x, y, width: bounds.width, height, visible: true }
}

/**
 * Publish current occupant bounds when desktop delivery is active.
 * @param reporter - preload bridge callback.
 * @param element - occupant host element, if mounted.
 * @param segmentVisible - toolbox browser segment visibility.
 * @param overlay - open chrome menu rectangle to keep above BrowserView.
 */
export function reportBrowserOccupantBounds(
  reporter: BrowserOccupantBoundsReporter | undefined,
  element: HTMLElement | null,
  segmentVisible: boolean,
  overlay: BrowserOccupantOverlay | null = null,
): void {
  if (reporter === undefined) return
  if (!segmentVisible) {
    reporter({ x: 0, y: 0, width: 0, height: 0, visible: false })
    return
  }
  if (element === null) return
  reporter(insetOccupantBoundsForOverlay(
    measureBrowserOccupantBounds(element, segmentVisible),
    overlay,
  ))
}
