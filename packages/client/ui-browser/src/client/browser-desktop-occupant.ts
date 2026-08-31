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

/** Preload callback forwarding occupant bounds to Main IPC. */
export type BrowserOccupantBoundsReporter = (bounds: BrowserOccupantBounds) => void

type DshDesktopShell = {
  delivery?: string
  reportBrowserOccupantBounds?: BrowserOccupantBoundsReporter
}

/**
 * Read the desktop occupant bounds reporter when integrated delivery exposes it.
 * @returns the reporter or undefined in browser / attach-without-bounds contexts.
 */
export function readDesktopBrowserOccupantReporter(): BrowserOccupantBoundsReporter | undefined {
  const bridge = (globalThis as { dsh?: DshDesktopShell }).dsh
  if (bridge?.delivery !== 'desktop') return undefined
  if (typeof bridge.reportBrowserOccupantBounds !== 'function') return undefined
  const report = bridge.reportBrowserOccupantBounds
  return (bounds: BrowserOccupantBounds) => { report(bounds) }
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
 * Publish current occupant bounds when desktop delivery is active.
 * @param reporter - preload bridge callback.
 * @param element - occupant host element, if mounted.
 * @param segmentVisible - toolbox browser segment visibility.
 */
export function reportBrowserOccupantBounds(
  reporter: BrowserOccupantBoundsReporter | undefined,
  element: HTMLElement | null,
  segmentVisible: boolean,
): void {
  if (reporter === undefined) return
  if (!segmentVisible) {
    reporter({ x: 0, y: 0, width: 0, height: 0, visible: false })
    return
  }
  if (element === null) return
  reporter(measureBrowserOccupantBounds(element, segmentVisible))
}
