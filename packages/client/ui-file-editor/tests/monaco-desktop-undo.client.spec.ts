// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  installMonacoDesktopUndoKeys,
  shouldHandleDesktopEditorUndo,
  triggerDesktopMonacoUndoRedo,
} from '../src/client/monaco-desktop-undo.ts'

describe('shouldHandleDesktopEditorUndo', () => {
  it('accepts Cmd+Z and Shift+Cmd+Z only while the editor is focused', () => {
    expect(shouldHandleDesktopEditorUndo(
      { metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, key: 'z' },
      true,
    )).toBe(true)
    expect(shouldHandleDesktopEditorUndo(
      { metaKey: true, ctrlKey: false, shiftKey: true, altKey: false, key: 'z' },
      true,
    )).toBe(true)
    expect(shouldHandleDesktopEditorUndo(
      { metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, key: 'z' },
      false,
    )).toBe(false)
  })
})

describe('triggerDesktopMonacoUndoRedo', () => {
  it('maps Z and Shift+Z to undo and redo', () => {
    const trigger = vi.fn()
    const editor = { trigger, onDidFocusEditorText: vi.fn(), onDidBlurEditorText: vi.fn() }
    triggerDesktopMonacoUndoRedo(editor, { metaKey: true, ctrlKey: false, shiftKey: false, key: 'z' })
    triggerDesktopMonacoUndoRedo(editor, { metaKey: true, ctrlKey: false, shiftKey: true, key: 'Z' })
    expect(trigger).toHaveBeenNthCalledWith(1, 'keyboard', 'undo', null)
    expect(trigger).toHaveBeenNthCalledWith(2, 'keyboard', 'redo', null)
  })
})

describe('installMonacoDesktopUndoKeys', () => {
  it('routes capture-phase Cmd+Z to Monaco on desktop delivery', () => {
    ;(window as Window & { dsh?: { delivery?: string } }).dsh = { delivery: 'desktop' }
    const trigger = vi.fn()
    let focusListener: (() => void) | undefined
    const editor = {
      trigger,
      onDidFocusEditorText: (listener: () => void) => {
        focusListener = listener
        return { dispose: vi.fn() }
      },
      onDidBlurEditorText: () => ({ dispose: vi.fn() }),
    }
    const dispose = installMonacoDesktopUndoKeys(editor)
    focusListener?.()
    const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true })
    const prevented = event.preventDefault.bind(event)
    event.preventDefault = vi.fn(prevented)
    window.dispatchEvent(event)
    expect(trigger).toHaveBeenCalledWith('keyboard', 'undo', null)
    expect(event.preventDefault).toHaveBeenCalled()
    dispose()
    delete (window as Window & { dsh?: { delivery?: string } }).dsh
  })

  it('is a no-op on web delivery', () => {
    delete (window as Window & { dsh?: { delivery?: string } }).dsh
    const trigger = vi.fn()
    const editor = {
      trigger,
      onDidFocusEditorText: vi.fn(() => ({ dispose: vi.fn() })),
      onDidBlurEditorText: vi.fn(() => ({ dispose: vi.fn() })),
    }
    const dispose = installMonacoDesktopUndoKeys(editor)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }))
    expect(trigger).not.toHaveBeenCalled()
    dispose()
  })
})
