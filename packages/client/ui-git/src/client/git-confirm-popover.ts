/** Place Git confirm popovers at a trigger's bottom-right corner. */

/** Gap from the trigger's bottom-right corner to the popover origin. */
export const CONFIRM_POPOVER_GAP = 4

/** Viewport inset so the popover never sits flush against an edge. */
const EDGE = 8

/** `position:fixed` origin for a confirm popover. */
export interface ConfirmPopoverBox {
  left: number
  top: number
}

/**
 * Place a popover so its top-left sits at the trigger's bottom-right, then
 * clamp into the viewport when the measured card size is known.
 * @param anchor - trigger bounding rect in viewport coordinates.
 * @param popover - measured card size; `0` skips that axis' clamp.
 * @param viewport - `window.innerWidth` / `innerHeight`.
 * @returns `position:fixed` left and top in CSS pixels.
 */
export function confirmPopoverPosition(
  anchor: Pick<DOMRect, 'right' | 'bottom'>,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
): ConfirmPopoverBox {
  let left = anchor.right + CONFIRM_POPOVER_GAP
  let top = anchor.bottom + CONFIRM_POPOVER_GAP
  if (popover.width > 0) {
    left = Math.min(Math.max(EDGE, left), Math.max(EDGE, viewport.width - popover.width - EDGE))
  }
  if (popover.height > 0) {
    top = Math.min(Math.max(EDGE, top), Math.max(EDGE, viewport.height - popover.height - EDGE))
  }
  return { left, top }
}
