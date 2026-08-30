// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  attachXtermImeGate,
  collapseImeLatinSpacing,
  forwardXtermInputWhenIdle,
} from '../src/client/xterm-ime-input.ts'

describe('collapseImeLatinSpacing', () => {
  it('collapses single-letter pinyin spacing', () => {
    expect(collapseImeLatinSpacing('l s')).toBe('ls')
    expect(collapseImeLatinSpacing('l s v')).toBe('lsv')
  })

  it('preserves ordinary English words and CJK commits', () => {
    expect(collapseImeLatinSpacing('hello world')).toBe('hello world')
    expect(collapseImeLatinSpacing('你好')).toBe('你好')
    expect(collapseImeLatinSpacing('a bc')).toBe('a bc')
  })
})

describe('forwardXtermInputWhenIdle', () => {
  it('blocks PTY forwarding during IME composition', () => {
    const forward = vi.fn()
    let composing = false
    forwardXtermInputWhenIdle('l', () => composing, forward)
    expect(forward).toHaveBeenCalledWith('l')
    forward.mockClear()
    composing = true
    forwardXtermInputWhenIdle(' ', () => composing, forward)
    forwardXtermInputWhenIdle('s', () => composing, forward)
    expect(forward).not.toHaveBeenCalled()
    composing = false
    forwardXtermInputWhenIdle('ls\n', () => composing, forward)
    expect(forward).toHaveBeenCalledWith('ls\n')
  })
})

describe('attachXtermImeGate', () => {
  it('tracks composition events on the xterm textarea', () => {
    const textarea = document.createElement('textarea')
    const gate = attachXtermImeGate(textarea)
    expect(gate.isComposing()).toBe(false)
    textarea.dispatchEvent(new CompositionEvent('compositionstart'))
    expect(gate.isComposing()).toBe(true)
    textarea.dispatchEvent(new CompositionEvent('compositionend'))
    expect(gate.isComposing()).toBe(false)
    gate.dispose()
  })
})
