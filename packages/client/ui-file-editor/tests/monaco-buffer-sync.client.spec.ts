// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { emitMonacoBuffer, markMonacoBufferPropApplied, planMonacoBufferPropApply, shouldSyncMonacoBuffer } from '../src/client/monaco-buffer-sync.ts'
import { installMonacoImeGuards } from '../src/client/MonacoEditor.tsx'

describe('shouldSyncMonacoBuffer', () => {
  it('skips prop reload while the editor is focused or composing', () => {
    expect(shouldSyncMonacoBuffer('Other\n', 'Hello\n', { composing: false, focused: true })).toBe(false)
    expect(shouldSyncMonacoBuffer('Other\n', 'Hello\n', { composing: true, focused: false })).toBe(false)
    expect(shouldSyncMonacoBuffer('Other\n', 'Hello\n', { composing: false, focused: false })).toBe(true)
    expect(shouldSyncMonacoBuffer('Hello\n', 'Hello\n', { composing: false, focused: false })).toBe(false)
  })

  it('forces prop reload while focused when external disk wins', () => {
    expect(shouldSyncMonacoBuffer('Other\n', 'Hello\n', { composing: false, focused: true }, { force: true }))
      .toBe(true)
    expect(shouldSyncMonacoBuffer('Other\n', 'Hello\n', { composing: true, focused: false }, { force: true }))
      .toBe(false)
  })
})

describe('emitMonacoBuffer', () => {
  it('writes upstream and tracks the last emitted value', () => {
    const onChange = vi.fn()
    const lastEmitted = { current: 'Hello\n' }
    emitMonacoBuffer('Hello world\n', onChange, lastEmitted)
    expect(onChange).toHaveBeenCalledWith('Hello world\n')
    expect(lastEmitted.current).toBe('Hello world\n')
  })
})

describe('planMonacoBufferPropApply', () => {
  it('does not consume diskReloadTicket until the buffer is marked applied', () => {
    const lastEmitted = { current: 'local\n' }
    const lastTicket = { current: 0 }
    const state = { composing: false, focused: true }
    const plan = planMonacoBufferPropApply('agent\n', 1, lastEmitted, lastTicket, state)
    expect(plan.force).toBe(true)
    expect(plan.shouldApply).toBe(true)
    expect(lastTicket.current).toBe(0)
    markMonacoBufferPropApplied('agent\n', 1, plan.force, lastEmitted, lastTicket)
    expect(lastTicket.current).toBe(1)
    expect(lastEmitted.current).toBe('agent\n')
    const retry = planMonacoBufferPropApply('agent\n', 1, lastEmitted, lastTicket, state)
    expect(retry.force).toBe(false)
    expect(retry.shouldApply).toBe(false)
  })
})

describe('installMonacoImeGuards', () => {
  it('defers buffer flush until composition ends', () => {
    const root = document.createElement('textarea')
    const syncState = { composing: false, focused: false }
    const flush = vi.fn()
    installMonacoImeGuards(root, syncState, flush)
    root.dispatchEvent(new CompositionEvent('compositionstart'))
    expect(syncState.composing).toBe(true)
    root.dispatchEvent(new CompositionEvent('compositionend'))
    expect(syncState.composing).toBe(false)
    expect(flush).toHaveBeenCalledTimes(1)
  })
})
