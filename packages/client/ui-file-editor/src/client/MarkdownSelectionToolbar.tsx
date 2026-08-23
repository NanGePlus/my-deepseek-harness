/** Floating formatting toolbar for the editable markdown preview selection. */

import { useEffect, useRef, useState } from 'react'
import type { EditorState } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { isTextSelection } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './EditableMarkdownPreview.module.css'

/** Props for {@link MarkdownSelectionToolbar}. */
export interface MarkdownSelectionToolbarProps {
  /** TipTap editor instance driving the preview surface. */
  editor: Editor
  /** Localized copy for toolbar control labels. */
  t: TranslateNS<'fileEditor'>
}

const bubbleOptions = {
  strategy: 'fixed' as const,
  placement: 'top' as const,
  offset: 8,
  flip: true,
  shift: true,
}

/**
 * Decide whether the formatting bubble menu should appear for the current selection.
 * @param editor - TipTap editor instance.
 * @param state - Current ProseMirror editor state.
 * @param from - Selection start (inclusive).
 * @param to - Selection end (exclusive).
 */
export function shouldShowMarkdownToolbar({
  editor, state, from, to, view,
}: {
  editor: Editor
  state: EditorState
  from: number
  to: number
  view: Editor['view']
}): boolean {
  if (!editor.isEditable) return false
  const { selection, doc } = state
  if (!isTextSelection(selection) || selection.empty || from === to) return false
  const isChildOfMenu = view.dom.ownerDocument.activeElement?.closest(
    '[data-markdown-selection-toolbar]',
  ) != null
  if (!view.hasFocus() && !isChildOfMenu) return false
  if (!doc.textBetween(from, to).length) return false
  if (editor.isActive('readOnlyFencedBlock')) return false
  return true
}

/** Active inline marks for the current preview selection. */
export interface MarkdownToolbarActiveMarks {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  link: boolean
}

/**
 * Read toolbar toggle states from the editor's current selection.
 * @param editor - TipTap editor instance.
 */
export function readMarkdownToolbarActiveMarks(editor: Editor): MarkdownToolbarActiveMarks {
  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    code: editor.isActive('code'),
    link: editor.isActive('link'),
  }
}

/**
 * Collapse the preview selection so the floating toolbar hides after link confirm.
 * @param editor - TipTap editor instance.
 */
export function dismissMarkdownToolbarSelection(editor: Editor): void {
  const { to } = editor.state.selection
  editor.chain().focus().setTextSelection(to).run()
}

/**
 * Apply or remove a link mark on the current preview selection.
 * @param editor - TipTap editor instance.
 * @param href - Target URL; empty removes the link mark.
 */
export function applyMarkdownLink(editor: Editor, href: string): void {
  if (href.length === 0) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}

/**
 * Show B/I/U/S/Code/Link actions when the user selects editable preview text.
 * @param props - Editor instance and locale helper.
 */
export function MarkdownSelectionToolbar({ editor, t }: MarkdownSelectionToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)
  const activeMarks = useEditorState({
    editor,
    selector: ({ editor: current }) => readMarkdownToolbarActiveMarks(current),
  })

  useEffect(() => {
    if (!linkOpen) return
    setLinkDraft((editor.getAttributes('link').href as string | undefined) ?? '')
    const id = window.requestAnimationFrame(() => {
      linkInputRef.current?.focus()
      linkInputRef.current?.select()
    })
    return () => { window.cancelAnimationFrame(id) }
  }, [linkOpen, editor])

  useEffect(() => {
    const closeOnEmptySelection = (): void => {
      if (editor.state.selection.empty) setLinkOpen(false)
    }
    editor.on('selectionUpdate', closeOnEmptySelection)
    return () => { editor.off('selectionUpdate', closeOnEmptySelection) }
  }, [editor])

  const selectionVisible = ({ editor: current, state, from, to, view }: {
    editor: Editor
    state: EditorState
    from: number
    to: number
    view: Editor['view']
  }): boolean => shouldShowMarkdownToolbar({ editor: current, state, from, to, view })

  const confirmLink = (): void => {
    applyMarkdownLink(editor, linkDraft.trim())
    setLinkOpen(false)
    dismissMarkdownToolbarSelection(editor)
  }

  const openLinkEditor = (): void => {
    setLinkDraft((editor.getAttributes('link').href as string | undefined) ?? '')
    setLinkOpen(true)
  }

  return (
    <BubbleMenu
      editor={editor}
      className={linkOpen ? css.linkPopover : css.toolbar}
      role={linkOpen ? 'dialog' : 'toolbar'}
      data-markdown-selection-toolbar=""
      aria-label={linkOpen ? t('editor.markdown.toolbar.link') : t('editor.markdown.toolbar.label')}
      updateDelay={0}
      appendTo={() => document.body}
      options={bubbleOptions}
      shouldShow={selectionVisible}
    >
      {linkOpen ? (
        <>
          <span className={css.linkPopoverIcon} aria-hidden>
            <LinkIcon />
          </span>
          <input
            ref={linkInputRef}
            className={css.linkPopoverInput}
            type="url"
            inputMode="url"
            value={linkDraft}
            placeholder={t('editor.markdown.toolbar.linkPlaceholder')}
            aria-label={t('editor.markdown.toolbar.linkPlaceholder')}
            onChange={(event) => { setLinkDraft(event.target.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                confirmLink()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setLinkOpen(false)
              }
            }}
          />
          <button
            type="button"
            className={css.linkPopoverConfirm}
            aria-label={t('editor.markdown.toolbar.linkConfirm')}
            onMouseDown={(event) => { event.preventDefault() }}
            onClick={confirmLink}
          >
            <CheckIcon />
          </button>
        </>
      ) : (
        <>
          <ToolbarButton
            label={t('editor.markdown.toolbar.bold')}
            active={activeMarks.bold}
            onClick={() => { editor.chain().focus().toggleBold().run() }}
          >
            B
          </ToolbarButton>
          <ToolbarButton
            label={t('editor.markdown.toolbar.italic')}
            active={activeMarks.italic}
            onClick={() => { editor.chain().focus().toggleItalic().run() }}
          >
            I
          </ToolbarButton>
          <ToolbarButton
            label={t('editor.markdown.toolbar.underline')}
            active={activeMarks.underline}
            onClick={() => { editor.chain().focus().toggleUnderline().run() }}
          >
            U
          </ToolbarButton>
          <ToolbarButton
            label={t('editor.markdown.toolbar.strike')}
            active={activeMarks.strike}
            onClick={() => { editor.chain().focus().toggleStrike().run() }}
          >
            S
          </ToolbarButton>
          <ToolbarButton
            label={t('editor.markdown.toolbar.code')}
            active={activeMarks.code}
            onClick={() => { editor.chain().focus().toggleCode().run() }}
          >
            {'</>'}
          </ToolbarButton>
          <ToolbarButton
            label={t('editor.markdown.toolbar.link')}
            active={activeMarks.link}
            onClick={openLinkEditor}
          >
            Lk
          </ToolbarButton>
        </>
      )}
    </BubbleMenu>
  )
}

/** One toolbar toggle button. */
function ToolbarButton({
  label, active, onClick, children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      className={clsx(css.toolbarButton, active && css.toolbarButtonActive)}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => { event.preventDefault() }}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Chain-link icon for the link popover. */
function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.2 9.8a2.6 2.6 0 0 0 3.7 0l1.8-1.8a2.6 2.6 0 1 0-3.7-3.7L7.1 5.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9.8 6.2a2.6 2.6 0 0 0-3.7 0L4.3 8a2.6 2.6 0 1 0 3.7 3.7L8.9 10.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Checkmark icon for confirming a link URL. */
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.2 6.7 11.4 12.5 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
