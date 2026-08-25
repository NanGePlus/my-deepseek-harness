/** Minimum Git ops-pane width in pixels. */
export const OPS_WIDTH_MIN = 180

/** Default ops-pane width in pixels before the user drags the split. */
export const OPS_WIDTH_DEFAULT = OPS_WIDTH_MIN

/** Maximum ops-pane width as a fraction of the Git panel width. */
export const OPS_WIDTH_MAX_RATIO = 0.7

/** Minimum diff-preview width reserved when dragging the ops split. */
export const PREVIEW_PANE_MIN = 200

/**
 * Clamp a dragged ops-pane width inside the Git panel split.
 * @param width - candidate width in pixels.
 * @param containerWidth - Git panel inner width in pixels.
 * @returns clamped ops-pane width.
 */
export function clampOpsWidth(width: number, containerWidth: number): number {
  const ratioMax = containerWidth * OPS_WIDTH_MAX_RATIO
  const previewMax = containerWidth - PREVIEW_PANE_MIN - 4
  const max = Math.min(ratioMax, previewMax)
  return Math.max(OPS_WIDTH_MIN, Math.min(width, max))
}
