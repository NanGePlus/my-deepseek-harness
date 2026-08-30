// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createScreencastViewport } from '../src/client/screencast-viewport.ts'

describe('createScreencastViewport', () => {
  it('paints JPEG frames and forwards pointer and keyboard events', () => {
    const onPointer = vi.fn()
    const onKeyboard = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)
    Object.defineProperty(host, 'clientWidth', { value: 800 })
    Object.defineProperty(host, 'clientHeight', { value: 600 })
    const viewport = createScreencastViewport({ zoom: 1, onPointer, onKeyboard })
    viewport.attach(host)
    viewport.setFrame({ data: 'ZmFrZQ==', width: 800, height: 600 })
    const stage = host.querySelector('div[tabindex="0"]') as HTMLElement
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}),
    })
    stage.dispatchEvent(new MouseEvent('mousedown', { clientX: 40, clientY: 30, button: 0, bubbles: true }))
    stage.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 30, button: 0, bubbles: true }))
    stage.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 40, bubbles: true }))
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    stage.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
    expect(onPointer).toHaveBeenCalled()
    expect(onKeyboard).toHaveBeenCalled()
    expect(host.querySelector('img')?.getAttribute('src')).toContain('data:image/jpeg;base64,')
    viewport.setZoom(1.5)
    viewport.focus()
    expect(viewport.getContentSize()).toEqual({ width: 800, height: 600 })
    viewport.setFrame(null)
    viewport.dispose()
    host.remove()
  })

  it('ignores pointer events when the stage has zero size', () => {
    const onPointer = vi.fn()
    const host = document.createElement('div')
    const viewport = createScreencastViewport({ zoom: 1, onPointer, onKeyboard: vi.fn() })
    viewport.attach(host)
    const stage = host.querySelector('div[tabindex="0"]') as HTMLElement
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
    })
    stage.dispatchEvent(new MouseEvent('mousedown', { clientX: 1, clientY: 1, button: 0, bubbles: true }))
    stage.dispatchEvent(new MouseEvent('mouseup', { clientX: 1, clientY: 1, button: 0, bubbles: true }))
    stage.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1, bubbles: true }))
    expect(onPointer).not.toHaveBeenCalled()
    viewport.dispose()
  })

  it('reattaches when the host element changes', () => {
    const hostA = document.createElement('div')
    const hostB = document.createElement('div')
    document.body.append(hostA, hostB)
    const viewport = createScreencastViewport({ zoom: 1, onPointer: vi.fn(), onKeyboard: vi.fn() })
    viewport.attach(hostA)
    viewport.attach(hostB)
    expect(hostA.childElementCount).toBe(0)
    expect(hostB.childElementCount).toBe(1)
    viewport.dispose()
    hostA.remove()
    hostB.remove()
  })

  it('derives content size from the stage when no frame has arrived yet', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    Object.defineProperty(host, 'clientWidth', { value: 400 })
    Object.defineProperty(host, 'clientHeight', { value: 300 })
    const viewport = createScreencastViewport({ zoom: 2, onPointer: vi.fn(), onKeyboard: vi.fn() })
    viewport.attach(host)
    const stage = host.querySelector('div[tabindex="0"]') as HTMLElement
    Object.defineProperty(stage, 'clientWidth', { value: 400 })
    Object.defineProperty(stage, 'clientHeight', { value: 300 })
    expect(viewport.getContentSize()).toEqual({ width: 200, height: 150 })
    viewport.dispose()
    host.remove()
  })

  it('maps non-left mouse buttons and reuses the same host attachment', () => {
    const onPointer = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const viewport = createScreencastViewport({ zoom: 2, onPointer, onKeyboard: vi.fn() })
    viewport.attach(host)
    viewport.attach(host)
    viewport.setFrame({ data: 'ZmFrZQ==', width: 800, height: 600 })
    const stage = host.querySelector('div[tabindex="0"]') as HTMLElement
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => ({}),
    })
    stage.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, button: 1, bubbles: true }))
    stage.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, button: 2, bubbles: true }))
    stage.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, button: 4, bubbles: true }))
    expect(onPointer).toHaveBeenCalled()
    expect(viewport.getContentSize()).toEqual({ width: 800, height: 600 })
    viewport.dispose()
    host.remove()
  })

  it('maps pointer coordinates from the stage before the first frame arrives', () => {
    const onPointer = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const viewport = createScreencastViewport({ zoom: 2, onPointer, onKeyboard: vi.fn() })
    viewport.attach(host)
    const stage = host.querySelector('div[tabindex="0"]') as HTMLElement
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => ({}),
    })
    stage.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, clientY: 30, button: 0, bubbles: true }))
    expect(onPointer).toHaveBeenCalled()
    viewport.dispose()
    host.remove()
  })

  it('returns null content size for zero-sized stages', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const viewport = createScreencastViewport({ zoom: 1, onPointer: vi.fn(), onKeyboard: vi.fn() })
    viewport.attach(host)
    const stage = host.querySelector('div[tabindex="0"]') as HTMLElement
    Object.defineProperty(stage, 'clientWidth', { value: 0 })
    Object.defineProperty(stage, 'clientHeight', { value: 0 })
    expect(viewport.getContentSize()).toBeNull()
    viewport.dispose()
    host.remove()
  })
})
