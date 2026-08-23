// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { cleanup } from '@testing-library/react'
import { createEditableMarkdownExtensions } from '../src/client/editable-markdown-extensions.ts'
import {
  previewClickCollapsePosition,
  shouldCollapsePreviewClickSelection,
  type PreviewClickSelectionGuardState,
} from '../src/client/preview-click-selection.ts'
import {
  shouldCollapseMonacoClickSelection,
  type MonacoClickSelectionGuardState,
} from '../src/client/monaco-click-selection.ts'

afterEach(cleanup)

function guardState(overrides: Partial<PreviewClickSelectionGuardState> = {}): PreviewClickSelectionGuardState {
  return { didDrag: false, trackingPrimary: true, ...overrides }
}

function monacoGuardState(overrides: Partial<MonacoClickSelectionGuardState> = {}): MonacoClickSelectionGuardState {
  return { didDrag: false, trackingPrimary: true, ...overrides }
}

describe('shouldCollapsePreviewClickSelection', () => {
  it('collapses a simple primary click when the selection is non-empty', () => {
    expect(shouldCollapsePreviewClickSelection(
      { button: 0, detail: 1, shiftKey: false, metaKey: false, ctrlKey: false },
      guardState(),
      false,
    )).toBe(true)
  })

  it('ignores drag, modifier, multi-click, and empty selections', () => {
    const event = { button: 0, detail: 1, shiftKey: false, metaKey: false, ctrlKey: false }
    expect(shouldCollapsePreviewClickSelection(event, guardState({ didDrag: true }), false)).toBe(false)
    expect(shouldCollapsePreviewClickSelection(
      { ...event, shiftKey: true },
      guardState(),
      false,
    )).toBe(false)
    expect(shouldCollapsePreviewClickSelection(
      { ...event, detail: 2 },
      guardState(),
      false,
    )).toBe(false)
    expect(shouldCollapsePreviewClickSelection(event, guardState(), true)).toBe(false)
  })
})

describe('shouldCollapseMonacoClickSelection', () => {
  it('collapses a simple primary click when the selection is non-empty', () => {
    expect(shouldCollapseMonacoClickSelection(
      { button: 0, detail: 1, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false },
      monacoGuardState(),
      false,
    )).toBe(true)
  })

  it('ignores drag, modifier, multi-click, and empty selections', () => {
    const event = {
      button: 0, detail: 1, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false,
    }
    expect(shouldCollapseMonacoClickSelection(event, monacoGuardState({ didDrag: true }), false)).toBe(false)
    expect(shouldCollapseMonacoClickSelection(
      { ...event, altKey: true },
      monacoGuardState(),
      false,
    )).toBe(false)
    expect(shouldCollapseMonacoClickSelection(
      { ...event, detail: 2 },
      monacoGuardState(),
      false,
    )).toBe(false)
    expect(shouldCollapseMonacoClickSelection(event, monacoGuardState(), true)).toBe(false)
  })
})

describe('previewClickCollapsePosition', () => {
  it('prefers the selection anchor on forward accidental ranges', () => {
    const editor = new Editor({
      extensions: createEditableMarkdownExtensions({
        codeLabels: { copyLabel: '复制', copiedLabel: '已复制' },
        mermaidSecurityLevel: 'loose',
      }),
      content: '<p>Hello preview text</p>',
    })
    editor.view.dispatch(editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, 3, 10),
    ))
    expect(previewClickCollapsePosition(editor.view, new MouseEvent('mouseup'))).toBe(3)
    editor.destroy()
  })
})
