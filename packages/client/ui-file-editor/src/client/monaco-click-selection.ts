/** Collapse accidental drag-free click selections in Monaco editors. */

import type { MonacoStandaloneEditor } from './monaco-load.ts'

/** Mutable drag state tracked between mouse down and up in Monaco. */
export interface MonacoClickSelectionGuardState {
  didDrag: boolean
  trackingPrimary: boolean
}

/**
 * Whether a mouse up should collapse a non-empty Monaco selection back to the click point.
 * @param event - Mouse up event from Monaco's editor mouse target.
 * @param guard - Drag tracking state from the paired mouse down.
 * @param selectionEmpty - Whether the editor selection is currently empty.
 */
export function shouldCollapseMonacoClickSelection(
  event: Pick<MouseEvent, 'button' | 'detail' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>,
  guard: MonacoClickSelectionGuardState,
  selectionEmpty: boolean,
): boolean {
  if (event.button !== 0 || event.detail !== 1) return false
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false
  if (!guard.trackingPrimary || guard.didDrag) return false
  return !selectionEmpty
}

/**
 * Collapse spurious non-empty selections after a simple click in Monaco.
 * Drag and multi-click (word/line select) are left untouched.
 * @param editor - Monaco standalone editor instance.
 */
export function installMonacoClickSelectionGuard(editor: MonacoStandaloneEditor): { dispose: () => void } {
  const guard: MonacoClickSelectionGuardState = { didDrag: false, trackingPrimary: false }

  const down = editor.onMouseDown((event) => {
    guard.trackingPrimary = event.event.button === 0
    guard.didDrag = false
  })
  const move = editor.onMouseMove((event) => {
    if (guard.trackingPrimary && (event.event.buttons & 1) !== 0) guard.didDrag = true
  })
  const up = editor.onMouseUp((event) => {
    const selection = editor.getSelection()
    const collapse = shouldCollapseMonacoClickSelection(
      event.event,
      guard,
      selection === null || selection.isEmpty(),
    )
    guard.trackingPrimary = false
    if (!collapse) return
    const pos = event.target.position
    if (pos === null || pos === undefined) return
    editor.setSelection({
      startLineNumber: pos.lineNumber,
      startColumn: pos.column,
      endLineNumber: pos.lineNumber,
      endColumn: pos.column,
    })
  })

  return {
    dispose: () => {
      down.dispose()
      move.dispose()
      up.dispose()
    },
  }
}
