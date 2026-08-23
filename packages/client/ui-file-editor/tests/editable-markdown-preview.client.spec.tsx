// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { EditableMarkdownPreview, emitPreviewMarkdown, shouldSyncPreviewBuffer } from '../src/client/EditableMarkdownPreview.tsx'
import { shouldShowMarkdownToolbar, applyMarkdownLink, readMarkdownToolbarActiveMarks, dismissMarkdownToolbarSelection } from '../src/client/MarkdownSelectionToolbar.tsx'
import { createEditableMarkdownExtensions } from '../src/client/editable-markdown-extensions.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

function createEditor(content: string): Editor {
  return new Editor({
    extensions: createEditableMarkdownExtensions({
      codeLabels: { copyLabel: '复制', copiedLabel: '已复制' },
      mermaidSecurityLevel: 'loose',
    }),
    content,
    contentType: 'markdown',
  })
}

describe('createEditableMarkdownExtensions', () => {
  it('serializes bold edits back to markdown emphasis', () => {
    const editor = createEditor('Bold me\n')
    editor.chain().focus().selectAll().toggleBold().run()
    expect(editor.getMarkdown()).toMatch(/\*\*Bold me\*\*/)
    editor.destroy()
  })

  it('round-trips fenced code blocks as read-only atom nodes', () => {
    const editor = createEditor('# Doc\n\n```js\nconst x = 1\n```\n')
    const fenced = editor.state.doc.content.content.find(node => node.type.name === 'readOnlyFencedBlock')
    expect(fenced?.attrs.language).toBe('js')
    expect(fenced?.attrs.content).toBe('const x = 1')
    expect(editor.getMarkdown()).toContain('```js')
    expect(editor.getMarkdown()).toContain('const x = 1')
    editor.destroy()
  })

  it('applies underline and strike marks to markdown', () => {
    const editor = createEditor('Styled text\n')
    editor.chain().focus().selectAll().toggleUnderline().toggleStrike().run()
    const markdown = editor.getMarkdown()
    expect(markdown).toMatch(/\+\+.*\+\+/)
    expect(markdown).toMatch(/~~.*~~/)
    editor.destroy()
  })

  it('renders preview links as clickable anchors', () => {
    const editor = createEditor('[Docs](https://example.com)\n')
    const anchor = editor.view.dom.querySelector('a[href="https://example.com"]')
    expect(anchor).not.toBeNull()
    expect(anchor?.textContent).toBe('Docs')
    editor.destroy()
  })
})

describe('EditableMarkdownPreview', () => {
  it('renders headings and exposes an editable preview textbox', async () => {
    render(
      <EditableMarkdownPreview
        value={'# Title\n\nPreview **body**\n'}
        ariaLabel="notes preview"
        t={makeTranslate(zh)}
        codeLabels={{ copyLabel: '复制', copiedLabel: '已复制' }}
        mermaidSecurityLevel="loose"
        onChange={() => {}}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeTruthy()
    })
    expect(screen.getByRole('textbox', { name: 'notes preview' }).getAttribute('contenteditable')).toBe('true')
  })

  it('keeps fenced code blocks read-only in preview', async () => {
    render(
      <EditableMarkdownPreview
        value={'# Doc\n\n```js\nconst x = 1\n```\n'}
        ariaLabel="notes preview"
        t={makeTranslate(zh)}
        codeLabels={{ copyLabel: '复制', copiedLabel: '已复制' }}
        mermaidSecurityLevel="loose"
        onChange={() => {}}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Doc' })).toBeTruthy()
    })
    const fenced = document.querySelector('[data-readonly-fenced-block]')
    expect(fenced).not.toBeNull()
    expect(fenced?.getAttribute('contenteditable')).toBe('false')
  })

  it('applies external buffer reloads without clobbering local edits first', async () => {
    const { rerender } = render(
      <EditableMarkdownPreview
        value={'Local\n'}
        ariaLabel="notes preview"
        t={makeTranslate(zh)}
        codeLabels={{ copyLabel: '复制', copiedLabel: '已复制' }}
        mermaidSecurityLevel="loose"
        onChange={() => {}}
      />,
    )
    const surface = await waitFor(() => screen.getByRole('textbox', { name: 'notes preview' }))
    expect(surface.textContent).toContain('Local')
    rerender(
      <EditableMarkdownPreview
        value={'Reloaded\n'}
        ariaLabel="notes preview"
        t={makeTranslate(zh)}
        codeLabels={{ copyLabel: '复制', copiedLabel: '已复制' }}
        mermaidSecurityLevel="loose"
        onChange={() => {}}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'notes preview' }).textContent).toContain('Reloaded')
    })
  })
})

describe('shouldSyncPreviewBuffer', () => {
  it('skips prop reload while the preview editor is focused or composing', () => {
    const focused = {
      isDestroyed: false,
      isFocused: true,
      view: { composing: false },
    }
    expect(shouldSyncPreviewBuffer(focused, 'Other\n', 'Hello\n')).toBe(false)
    const composing = {
      isDestroyed: false,
      isFocused: false,
      view: { composing: true },
    }
    expect(shouldSyncPreviewBuffer(composing, 'Other\n', 'Hello\n')).toBe(false)
    const idle = {
      isDestroyed: false,
      isFocused: false,
      view: { composing: false },
    }
    expect(shouldSyncPreviewBuffer(idle, 'Other\n', 'Hello\n')).toBe(true)
    expect(shouldSyncPreviewBuffer(idle, 'Hello\n', 'Hello\n')).toBe(false)
  })
})

describe('applyMarkdownLink', () => {
  it('sets a link mark on the current selection', () => {
    const editor = createEditor('Visit docs\n')
    editor.chain().focus().selectAll().run()
    applyMarkdownLink(editor, 'https://example.com')
    expect(editor.getMarkdown()).toContain('[Visit docs](https://example.com)')
    editor.destroy()
  })

  it('removes the link mark when href is empty', () => {
    const editor = createEditor('[Linked](https://example.com)\n')
    editor.chain().focus().selectAll().run()
    applyMarkdownLink(editor, '')
    expect(editor.getMarkdown()).not.toContain('](https://example.com)')
    editor.destroy()
  })
})

describe('readMarkdownToolbarActiveMarks', () => {
  it('reflects marks on the current selection only', () => {
    const editor = createEditor('**Bold** plain\n')
    const boldStart = editor.state.doc.textBetween(0, editor.state.doc.content.size).indexOf('Bold') + 1
    editor.commands.setTextSelection({ from: boldStart, to: boldStart + 4 })
    expect(readMarkdownToolbarActiveMarks(editor).bold).toBe(true)

    const plainStart = editor.state.doc.textBetween(0, editor.state.doc.content.size).indexOf('plain') + 1
    editor.commands.setTextSelection({ from: plainStart, to: plainStart + 5 })
    expect(readMarkdownToolbarActiveMarks(editor).bold).toBe(false)
    editor.destroy()
  })
})

describe('dismissMarkdownToolbarSelection', () => {
  it('collapses the selection after confirming a link edit', () => {
    const editor = createEditor('Visit docs\n')
    editor.chain().focus().selectAll().run()
    applyMarkdownLink(editor, 'https://example.com')
    dismissMarkdownToolbarSelection(editor)
    expect(editor.state.selection.empty).toBe(true)
    editor.destroy()
  })
})

describe('shouldShowMarkdownToolbar', () => {
  it('returns true for a non-empty text selection inside the preview editor', () => {
    const editor = createEditor('Select me\n')
    const { doc } = editor.state
    const from = 1
    const to = doc.content.size - 1
    editor.commands.setTextSelection({ from, to })
    const { view } = editor
    vi.spyOn(view, 'hasFocus').mockReturnValue(true)
    expect(shouldShowMarkdownToolbar({
      editor,
      state: editor.state,
      from,
      to,
      view,
    })).toBe(true)
    editor.destroy()
  })
})

describe('emitPreviewMarkdown', () => {
  it('does not emit while the editor reports an active IME composition', () => {
    const editor = createEditor('Hello\n')
    const onChange = vi.fn()
    const lastEmitted = { current: 'Hello\n' }
    Object.defineProperty(editor.view, 'composing', { configurable: true, get: () => true })
    if (!editor.view.composing) {
      emitPreviewMarkdown(() => editor.getMarkdown(), onChange, lastEmitted)
    }
    expect(onChange).not.toHaveBeenCalled()
    Object.defineProperty(editor.view, 'composing', { configurable: true, get: () => false })
    emitPreviewMarkdown(() => editor.getMarkdown(), onChange, lastEmitted)
    expect(onChange).toHaveBeenCalled()
    editor.destroy()
  })
})
