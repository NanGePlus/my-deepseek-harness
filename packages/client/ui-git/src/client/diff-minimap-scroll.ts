import type { MinimapMarker } from './diff-minimap-model.ts'

/** Attribute on each minimap-tracked preview row element. */
export const DIFF_ROW_ATTR = 'data-diff-row'

/**
 * Map a minimap vertical ratio to a preview scrollTop.
 * @param ratio - position along the minimap track, 0–1.
 * @param scrollHeight - scrollport scrollHeight in pixels.
 * @param clientHeight - scrollport clientHeight in pixels.
 */
export function scrollTopForMinimapRatio(
  ratio: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const maxScroll = scrollHeight - clientHeight
  if (maxScroll <= 0) return 0
  const clamped = Math.max(0, Math.min(1, ratio))
  return clamped * maxScroll
}

/**
 * Scroll the diff preview to a minimap marker.
 * @param scrollEl - diff preview scrollport.
 * @param marker - minimap marker for the target change.
 */
export function scrollPreviewToMinimapMarker(
  scrollEl: HTMLElement,
  marker: MinimapMarker,
): void {
  const rowEls = scrollEl.querySelectorAll(`[${DIFF_ROW_ATTR}]`)
  const target = rowEls.item(marker.rowIndex)
  if (target instanceof HTMLElement) {
    target.scrollIntoView({ block: 'center' })
    return
  }
  scrollEl.scrollTop = scrollTopForMinimapRatio(
    marker.topRatio,
    scrollEl.scrollHeight,
    scrollEl.clientHeight,
  )
}

/**
 * Scroll the diff preview to a click position on the minimap track.
 * @param scrollEl - diff preview scrollport.
 * @param trackEl - minimap track element.
 * @param clientY - pointer clientY in viewport coordinates.
 */
export function scrollPreviewToMinimapTrackClick(
  scrollEl: HTMLElement,
  trackEl: HTMLElement,
  clientY: number,
): void {
  const trackRect = trackEl.getBoundingClientRect()
  if (trackRect.height <= 0) return
  const ratio = (clientY - trackRect.top) / trackRect.height
  scrollEl.scrollTop = scrollTopForMinimapRatio(
    ratio,
    scrollEl.scrollHeight,
    scrollEl.clientHeight,
  )
}
