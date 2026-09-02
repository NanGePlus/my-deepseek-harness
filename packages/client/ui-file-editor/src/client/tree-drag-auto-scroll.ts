/** Auto-scroll the file-tree pane while dragging entries near its edges. */

/** Distance from the scroll viewport edge that starts auto-scroll. */
export const TREE_DRAG_SCROLL_EDGE_PX = 28

/** Pixels to scroll per animation frame while dragging near an edge. */
export const TREE_DRAG_SCROLL_STEP_PX = 10

/**
 * Scroll a tree viewport when a drag pointer sits near its top or bottom edge.
 * @param scrollElement - the overflow scroll container.
 * @param clientY - pointer Y in viewport coordinates.
 */
export function stepTreeDragAutoScroll(
  scrollElement: HTMLElement | null,
  clientY: number,
): void {
  if (scrollElement === null) return
  const rect = scrollElement.getBoundingClientRect()
  if (clientY < rect.top + TREE_DRAG_SCROLL_EDGE_PX) {
    scrollElement.scrollTop -= TREE_DRAG_SCROLL_STEP_PX
  } else if (clientY > rect.bottom - TREE_DRAG_SCROLL_EDGE_PX) {
    scrollElement.scrollTop += TREE_DRAG_SCROLL_STEP_PX
  }
}
