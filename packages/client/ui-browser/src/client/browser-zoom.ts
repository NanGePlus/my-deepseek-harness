/** Client-side screencast zoom limits and step helpers. */

import { DEFAULT_BROWSER_ZOOM } from './stores.ts'

/** Minimum screencast zoom ratio. */
export const BROWSER_ZOOM_MIN = 0.5

/** Maximum screencast zoom ratio. */
export const BROWSER_ZOOM_MAX = 2

/** Zoom step applied by overflow-menu − / + controls. */
export const BROWSER_ZOOM_STEP = 0.25

/**
 * Clamp one zoom ratio to the supported screencast range.
 * @param zoom - requested zoom ratio.
 */
export function clampBrowserZoom(zoom: number): number {
  return Math.min(BROWSER_ZOOM_MAX, Math.max(BROWSER_ZOOM_MIN, zoom))
}

/**
 * Step zoom toward smaller or larger screencast scale.
 * @param zoom - current zoom ratio.
 * @param direction - `-1` zooms out; `1` zooms in.
 */
export function stepBrowserZoom(zoom: number, direction: -1 | 1): number {
  return clampBrowserZoom(Number((zoom + direction * BROWSER_ZOOM_STEP).toFixed(2)))
}

/**
 * Format zoom as a whole-percent label for the overflow menu.
 * @param zoom - current zoom ratio.
 */
export function formatBrowserZoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

/** True when zoom matches the default screencast scale. */
export function isDefaultBrowserZoom(zoom: number): boolean {
  return zoom === DEFAULT_BROWSER_ZOOM
}
