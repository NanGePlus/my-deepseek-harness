// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

const listeners: Array<() => void> = []
let model = 'hello'
const editor = {
  getValue: (): string => model,
  setValue: (next: string): void => { model = next },
  onDidChangeModelContent: (listener: () => void): void => { listeners.push(listener) },
  dispose: vi.fn(),
}
const defineTheme = vi.fn()
const create = vi.fn(() => editor)

let loadImpl: () => Promise<unknown> = () => Promise.resolve({
  editor: { defineTheme, create },
})

vi.mock('../src/client/monaco-load.ts', () => ({
  loadMonacoEditor: () => loadImpl(),
}))

const { MonacoEditor } = await import('../src/client/MonacoEditor.tsx')

afterEach(cleanup)

beforeEach(() => {
  listeners.length = 0
  model = 'hello'
  defineTheme.mockClear()
  create.mockClear()
  editor.dispose.mockClear()
  loadImpl = () => Promise.resolve({
    editor: { defineTheme, create },
  })
  delete (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment
  document.body.style.setProperty('--dsw-specific-sidebar-fill', '#F9FAFB')
  document.body.style.setProperty('--dsw-alias-bg-base', '#FFFFFF')
  document.body.style.setProperty('--dsw-alias-label-primary', '#0F1115')
  document.body.style.setProperty('--ds-font-family-code', 'ui-monospace')
  vi.stubGlobal('Worker', class {
    url: string
    constructor(url: string) { this.url = url }
    terminate(): void {}
  })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('MonacoEditor', () => {
  it('mounts monaco, reports edits, and follows value and theme changes', async () => {
    const onChange = vi.fn()
    const view = render(
      <MonacoEditor
        path="/w/a.ts"
        value="hello"
        language="typescript"
        ariaLabel="a.ts，TypeScript，浅色"
        dark={false}
        onChange={onChange}
      />,
    )
    await waitFor(() => { expect(create).toHaveBeenCalled() })
    expect(defineTheme).toHaveBeenCalled()
    const host = view.container.querySelector('[role="textbox"]')
    expect(host?.getAttribute('aria-label')).toBe('a.ts，TypeScript，浅色')
    const env = (globalThis as unknown as { MonacoEnvironment: { getWorker: () => Worker } }).MonacoEnvironment
    expect(env.getWorker()).toBeInstanceOf(Worker)

    model = 'hello'
    act(() => { listeners[0]!() })
    expect(onChange).not.toHaveBeenCalled()
    model = 'edited'
    act(() => { listeners[0]!() })
    expect(onChange).toHaveBeenCalledWith('edited')

    view.rerender(
      <MonacoEditor
        path="/w/a.ts"
        value="edited"
        language="typescript"
        ariaLabel="a.ts，TypeScript，浅色"
        dark={false}
        onChange={onChange}
      />,
    )
    expect(model).toBe('edited')

    view.rerender(
      <MonacoEditor
        path="/w/a.ts"
        value="from-store"
        language="typescript"
        ariaLabel="a.ts，TypeScript，浅色"
        dark={false}
        onChange={onChange}
      />,
    )
    expect(model).toBe('from-store')

    view.rerender(
      <MonacoEditor
        path="/w/a.ts"
        value="from-store"
        language="typescript"
        ariaLabel="a.ts，TypeScript，深色"
        dark={true}
        onChange={onChange}
      />,
    )
    await waitFor(() => { expect(create).toHaveBeenCalledTimes(2) })
  })

  it('keeps the textarea when monaco is unavailable or create throws', async () => {
    loadImpl = () => Promise.resolve(undefined)
    const missing = render(
      <MonacoEditor
        path="/w/a.ts"
        value="x"
        language="typescript"
        ariaLabel="a.ts"
        dark={false}
        onChange={() => {}}
      />,
    )
    await waitFor(() => { expect(missing.container.querySelector('textarea')).toBeTruthy() })
    missing.unmount()

    loadImpl = () => Promise.resolve({ editor: { defineTheme, create: () => { throw new Error('fail') } } })
    const failed = render(
      <MonacoEditor
        path="/w/a.ts"
        value="x"
        language="typescript"
        ariaLabel="a.ts"
        dark={false}
        onChange={() => {}}
      />,
    )
    await waitFor(() => { expect(failed.container.querySelector('textarea')).toBeTruthy() })
  })

  it('does not mount monaco after unmount', async () => {
    let release!: (value: unknown) => void
    loadImpl = () => new Promise((resolve) => { release = resolve })
    const view = render(
      <MonacoEditor
        path="/w/a.ts"
        value="x"
        language="typescript"
        ariaLabel="a.ts"
        dark={false}
        onChange={() => {}}
      />,
    )
    view.unmount()
    await act(async () => {
      release({ editor: { defineTheme, create } })
    })
    expect(create).not.toHaveBeenCalled()
  })
})
