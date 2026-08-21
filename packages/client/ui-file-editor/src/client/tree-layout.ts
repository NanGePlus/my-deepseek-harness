/** Minimum file-tree width in pixels. */
export const TREE_WIDTH_MIN = 180

/** Default file-tree width in pixels before the user drags the split. */
export const TREE_WIDTH_DEFAULT = TREE_WIDTH_MIN

/** Maximum file-tree width as a fraction of the editor-surface width. */
export const TREE_WIDTH_MAX_RATIO = 0.7

/** Minimum editor-pane width reserved when dragging the tree split. */
export const EDITOR_PANE_MIN = 200

/**
 * Clamp a dragged file-tree width inside the editor-surface.
 * @param width - candidate width in pixels.
 * @param containerWidth - editor-surface inner width in pixels.
 * @returns clamped tree width.
 */
export function clampTreeWidth(width: number, containerWidth: number): number {
  const ratioMax = containerWidth * TREE_WIDTH_MAX_RATIO
  const editorMax = containerWidth - EDITOR_PANE_MIN - 4
  const max = Math.min(ratioMax, editorMax)
  return Math.max(TREE_WIDTH_MIN, Math.min(width, max))
}
