// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { GitSplitHandle } from '../src/client/GitSplitHandle.tsx'

function drag(handle: Element, fromX: number, toX: number): void {
  const down = new PointerEvent('pointerdown', { pointerId: 1, clientX: fromX, bubbles: true })
  const move = new PointerEvent('pointermove', { pointerId: 1, clientX: toX, bubbles: true })
  const up = new PointerEvent('pointerup', { pointerId: 1, clientX: toX, bubbles: true })
  act(() => { handle.dispatchEvent(down) })
  act(() => { handle.dispatchEvent(move); vi.advanceTimersByTime(20) })
  act(() => { handle.dispatchEvent(up) })
}

describe('GitSplitHandle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => { cb(0) }, 16) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (h: number) => { clearTimeout(h) })
    const captured = new WeakSet<Element>()
    Element.prototype.setPointerCapture = function () { captured.add(this) }
    Element.prototype.releasePointerCapture = function () { captured.delete(this) }
    Element.prototype.hasPointerCapture = function () { return captured.has(this) }
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reports horizontal drag delta on pointer up', () => {
    const onStart = vi.fn()
    const onDrag = vi.fn()
    const onEnd = vi.fn()
    const view = render(
      <GitSplitHandle ariaLabel="Resize Git panel" onStart={onStart} onDrag={onDrag} onEnd={onEnd} />,
    )
    const handle = view.getByRole('separator', { name: 'Resize Git panel' })
    drag(handle, 400, 460)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onDrag).toHaveBeenCalled()
    expect(onDrag.mock.calls.some(call => call[0] === 60)).toBe(true)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
