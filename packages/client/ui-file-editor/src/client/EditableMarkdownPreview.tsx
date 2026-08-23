/** WYSIWYG markdown preview editor backed by TipTap and markdown round-trip. */

import { useEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import { EditorContent, useEditor } from '@tiptap/react'
import type { MarkdownCodeLabels, MermaidSecurityLevel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { createEditableMarkdownExtensions } from './editable-markdown-extensions.ts'
import { MarkdownSelectionToolbar } from './MarkdownSelectionToolbar.tsx'
import css from './EditableMarkdownPreview.module.css'

/** Props for {@link EditableMarkdownPreview}. */
export interface EditableMarkdownPreviewProps {
  /** Current markdown buffer shown in preview mode. */
  value: string
  /** Accessible name for the editable preview surface. */
  ariaLabel: string
  /** Localized copy. */
  t: TranslateNS<'fileEditor'>
  /** Copy labels for read-only code fences. */
  codeLabels: MarkdownCodeLabels
  /** Mermaid security level for read-only diagram fences. */
  mermaidSecurityLevel: MermaidSecurityLevel
  /**
   * Preview edit callback.
   * @param value - Updated markdown after a preview-side edit.
   */
  onChange: (value: string) => void
}

/**
 * Push the current editor markdown into the buffer when editing is settled.
 * @param getMarkdown - Reads the live TipTap markdown snapshot.
 * @param onChange - Parent buffer callback.
 * @param lastEmitted - Tracks the last markdown written upstream.
 */
export function emitPreviewMarkdown(
  getMarkdown: () => string,
  onChange: (value: string) => void,
  lastEmitted: { current: string },
): void {
  const markdown = getMarkdown()
  lastEmitted.current = markdown
  onChange(markdown)
}

/** Returns true when preview buffer may be reloaded from props without clobbering live edits. */
export function shouldSyncPreviewBuffer(
  editor: { isDestroyed: boolean; isFocused: boolean; view: { composing: boolean } },
  value: string,
  lastEmitted: string,
): boolean {
  if (editor.isDestroyed || editor.isFocused || editor.view.composing) return false
  return value !== lastEmitted
}

/**
 * Render an editable markdown preview with inline formatting and read-only fenced blocks.
 * @param props - Buffer value, labels, and change callback.
 */
export function EditableMarkdownPreview({
  value, ariaLabel, t, codeLabels, mermaidSecurityLevel, onChange,
}: EditableMarkdownPreviewProps) {
  const lastEmitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const copyLabel = codeLabels.copyLabel
  const copiedLabel = codeLabels.copiedLabel
  const extensions = useMemo(
    () => createEditableMarkdownExtensions({
      codeLabels: { copyLabel, copiedLabel },
      mermaidSecurityLevel,
    }),
    [copyLabel, copiedLabel, mermaidSecurityLevel],
  )

  const editor = useEditor({
    extensions,
    content: value,
    contentType: 'markdown',
    editable: true,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: css.proseMirror,
        role: 'textbox',
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: current }) => {
      if (current.view.composing) return
      emitPreviewMarkdown(() => current.getMarkdown(), onChangeRef.current, lastEmitted)
    },
  }, [extensions, ariaLabel])

  useEffect(() => {
    if (!editor || !shouldSyncPreviewBuffer(editor, value, lastEmitted.current)) return
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    lastEmitted.current = value
  }, [editor, value])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const dom = editor.view.dom
    const flushComposition = (): void => {
      if (editor.isDestroyed || editor.view.composing) return
      emitPreviewMarkdown(() => editor.getMarkdown(), onChangeRef.current, lastEmitted)
    }
    dom.addEventListener('compositionend', flushComposition)
    return () => { dom.removeEventListener('compositionend', flushComposition) }
  }, [editor])

  if (!editor) return null

  return (
    <div className={clsx(css.root, 'markdown')}>
      <MarkdownSelectionToolbar editor={editor} t={t} />
      <EditorContent editor={editor} className={css.editor} />
    </div>
  )
}
