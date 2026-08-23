/** Floating Add to Chat toolbar for Monaco source selections. */

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { MonacoStandaloneEditor } from './monaco-load.ts'
import { monacoSelectionLineRange } from './file-context-ref.ts'
import css from './MonacoSourceSelectionToolbar.module.css'

/** Props for {@link MonacoSourceSelectionToolbar}. */
export interface MonacoSourceSelectionToolbarProps {
  /** Live Monaco editor instance. */
  editor: MonacoStandaloneEditor
  /** Accessible toolbar label. */
  toolbarLabel: string
  /** Add to Chat button label. */
  addToChatLabel: string
  /**
   * Insert the current source selection into the session composer.
   * @param range - one-based inclusive line range.
   */
  onAddToChat: (range: { startLine: number; endLine: number }) => void
}

type ToolbarPlacement = {
  top: number
  left: number
}

/** Minimal Monaco editor face used by the source selection toolbar. */
type MonacoEditorWithSelection = MonacoStandaloneEditor

/**
 * Resolve toolbar coordinates for the current non-empty selection.
 * @param editor - Monaco editor with selection APIs.
 */
export function monacoSourceSelectionToolbarPlacement(
  editor: MonacoEditorWithSelection,
): ToolbarPlacement | null {
  const selection = editor.getSelection()
  if (selection === null || selection.isEmpty()) return null
  const anchorLine = Math.min(selection.startLineNumber, selection.endLineNumber)
  const position = editor.getScrolledVisiblePosition({
    lineNumber: anchorLine,
    column: selection.endColumn,
  })
  if (position === null) return null
  return {
    top: Math.max(8, position.top - 40),
    left: Math.max(8, position.left),
  }
}

/**
 * Render Add to Chat above a non-empty Monaco source selection.
 * @param props - editor instance, labels, and insert callback.
 */
export function MonacoSourceSelectionToolbar({
  editor, toolbarLabel, addToChatLabel, onAddToChat,
}: MonacoSourceSelectionToolbarProps) {
  const richEditor = editor
  const [visible, setVisible] = useState(false)
  const [placement, setPlacement] = useState<ToolbarPlacement | null>(null)
  const [lineRange, setLineRange] = useState<{ startLine: number; endLine: number } | null>(null)

  useEffect(() => {
    const sync = (): void => {
      const selection = richEditor.getSelection()
      if (selection === null || selection.isEmpty()) {
        setVisible(false)
        setPlacement(null)
        setLineRange(null)
        return
      }
      setVisible(true)
      setPlacement(monacoSourceSelectionToolbarPlacement(richEditor))
      setLineRange(monacoSelectionLineRange(selection.startLineNumber, selection.endLineNumber))
    }

    sync()
    const selectionOff = richEditor.onDidChangeCursorSelection(sync)
    const blurOff = richEditor.onDidBlurEditorText(() => { setVisible(false) })
    const dom = richEditor.getDomNode()
    const scrollHost = dom?.closest('.monaco-scrollable-element')
    scrollHost?.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      selectionOff.dispose()
      blurOff.dispose()
      scrollHost?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [richEditor])

  if (!visible || placement === null || lineRange === null) return null

  return (
    <div
      className={clsx(css.toolbar)}
      role="toolbar"
      aria-label={toolbarLabel}
      style={{ top: placement.top, left: placement.left }}
      onMouseDown={(event) => { event.preventDefault() }}
    >
      <button
        type="button"
        className={css.action}
        onClick={() => { onAddToChat(lineRange) }}
      >
        {addToChatLabel}
      </button>
    </div>
  )
}
