// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { FitAddon } from '@xterm/addon-fit'
import { createXtermViewport } from '../src/client/xterm-viewport.ts'

describe('createXtermViewport', () => {
  it('forwards input, output, theme, resize, and dispose', () => {
    const onInput = vi.fn()
    const onResize = vi.fn()
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 400 })
    Object.defineProperty(host, 'clientHeight', { value: 300 })
    document.body.appendChild(host)
    const viewport = createXtermViewport({ dark: false, onInput, onResize })
    viewport.attach(host)
    viewport.write('hello')
    viewport.setDark(true)
    viewport.fit()
    viewport.fit()
    viewport.dispose()
    document.body.removeChild(host)
    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('no-ops fit before the terminal is attached', () => {
    const onResize = vi.fn()
    const viewport = createXtermViewport({ dark: false, onInput: vi.fn(), onResize })
    viewport.fit()
    expect(onResize).not.toHaveBeenCalled()
  })

  it('no-ops fit while the host has zero layout size', () => {
    const onResize = vi.fn()
    const host = document.createElement('div')
    const viewport = createXtermViewport({ dark: false, onInput: vi.fn(), onResize })
    viewport.attach(host)
    viewport.fit()
    expect(onResize).not.toHaveBeenCalled()
  })

  it('survives FitAddon fit failures while the panel is still hidden', () => {
    const onResize = vi.fn()
    const host = document.createElement('div')
    Object.defineProperty(host, 'clientWidth', { value: 400 })
    Object.defineProperty(host, 'clientHeight', { value: 300 })
    const fit = vi.spyOn(FitAddon.prototype, 'fit').mockImplementation(() => {
      throw new Error('dimensions')
    })
    const viewport = createXtermViewport({ dark: false, onInput: vi.fn(), onResize })
    viewport.attach(host)
    viewport.fit()
    expect(onResize).not.toHaveBeenCalled()
    fit.mockRestore()
  })
})
