/** Collapse accidental drag-free click selections in the editable markdown preview. */

import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/** Mutable drag state tracked between mouse down and up on the preview surface. */
export interface PreviewClickSelectionGuardState {
  didDrag: boolean
  trackingPrimary: boolean
}

/**
 * Resolve the document position for collapsing an accidental click selection.
 * @param view - ProseMirror view backing the preview editor.
 * @param event - Mouse up event on the preview surface.
 */
export function previewClickCollapsePosition(view: EditorView, event: MouseEvent): number {
  try {
    const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
    if (coords !== null) return coords.pos
  } catch {
    // Hosts without layout APIs (for example jsdom) fall back to the nearer selection edge.
  }
  const { head, anchor } = view.state.selection
  return head <= anchor ? head : anchor
}

/**
 * Whether a mouse up should collapse a non-empty selection back to the click point.
 * @param event - Mouse up event on the preview surface.
 * @param guard - Drag tracking state from the paired mouse down.
 * @param selectionEmpty - Whether the editor selection is currently empty.
 */
export function shouldCollapsePreviewClickSelection(
  event: Pick<MouseEvent, 'button' | 'detail' | 'shiftKey' | 'metaKey' | 'ctrlKey'>,
  guard: PreviewClickSelectionGuardState,
  selectionEmpty: boolean,
): boolean {
  if (event.button !== 0 || event.detail !== 1) return false
  if (event.shiftKey || event.metaKey || event.ctrlKey) return false
  if (!guard.trackingPrimary || guard.didDrag) return false
  return !selectionEmpty
}

/**
 * Attach listeners that collapse spurious non-empty selections after a simple click.
 * Drag and multi-click (word/line select) are left untouched.
 * @param view - ProseMirror view backing the preview editor.
 */
export function installPreviewClickSelectionGuard(view: EditorView): () => void {
  const guard: PreviewClickSelectionGuardState = { didDrag: false, trackingPrimary: false }
  const dom = view.dom

  const onMouseDown = (event: MouseEvent): void => {
    guard.trackingPrimary = event.button === 0
    guard.didDrag = false
  }
  const onMouseMove = (): void => {
    if (guard.trackingPrimary) guard.didDrag = true
  }
  const onMouseUp = (event: MouseEvent): void => {
    const collapse = shouldCollapsePreviewClickSelection(
      event,
      guard,
      view.state.selection.empty,
    )
    guard.trackingPrimary = false
    if (!collapse) return
    const pos = previewClickCollapsePosition(view, event)
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos))
    view.dispatch(tr)
  }

  dom.addEventListener('mousedown', onMouseDown)
  dom.addEventListener('mousemove', onMouseMove)
  dom.addEventListener('mouseup', onMouseUp)
  return () => {
    dom.removeEventListener('mousedown', onMouseDown)
    dom.removeEventListener('mousemove', onMouseMove)
    dom.removeEventListener('mouseup', onMouseUp)
  }
}
