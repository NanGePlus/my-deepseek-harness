/** Desktop Electron: route Cmd+Z to Monaco when native Edit undo roles are omitted. */

import { isDesktopShellDelivery } from './desktop-shell-delivery.ts'

/** Monaco surface that can run undo/redo actions. */
export interface MonacoUndoEditor {
  /** Monaco {@link IStandaloneCodeEditor.trigger}. */
  trigger: (source: string, handlerId: string, payload: unknown) => void
  /** Fires when the editor text surface receives focus. */
  onDidFocusEditorText: (listener: () => void) => { dispose: () => void }
  /** Fires when the editor text surface loses focus. */
  onDidBlurEditorText: (listener: () => void) => { dispose: () => void }
}

/**
 * Whether a keydown should invoke editor undo/redo on desktop delivery.
 * @param event - keyboard event from the capture listener.
 * @param editorFocused - true when the target editor surface is focused.
 */
export function shouldHandleDesktopEditorUndo(
  event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'key'>,
  editorFocused: boolean,
): boolean {
  if (!editorFocused) return false
  if (!event.metaKey && !event.ctrlKey) return false
  if (event.altKey) return false
  const key = event.key.toLowerCase()
  if (key === 'z') return true
  if (key === 'y' && event.ctrlKey && !event.metaKey) return true
  return false
}

/**
 * Run Monaco undo or redo for a desktop undo key chord.
 * @param editor - focused Monaco instance.
 * @param event - keyboard event from the capture listener.
 */
export function triggerDesktopMonacoUndoRedo(
  editor: MonacoUndoEditor,
  event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'key'>,
): void {
  const key = event.key.toLowerCase()
  const redo = key === 'y' || event.shiftKey
  editor.trigger('keyboard', redo ? 'redo' : 'undo', null)
}

/**
 * Install capture-phase undo/redo routing for desktop Electron.
 * @param editor - Monaco instance bound to one editable tab.
 * @returns disposer; no-op when not desktop delivery.
 */
export function installMonacoDesktopUndoKeys(editor: MonacoUndoEditor): () => void {
  if (!isDesktopShellDelivery()) return () => {}
  let focused = false
  const focusSub = editor.onDidFocusEditorText(() => { focused = true })
  const blurSub = editor.onDidBlurEditorText(() => { focused = false })
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!shouldHandleDesktopEditorUndo(event, focused)) return
    event.preventDefault()
    triggerDesktopMonacoUndoRedo(editor, event)
  }
  window.addEventListener('keydown', onKeyDown, true)
  return () => {
    focusSub.dispose()
    blurSub.dispose()
    window.removeEventListener('keydown', onKeyDown, true)
  }
}
