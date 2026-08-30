// @vitest-environment jsdom
/**
 * Scroll-revealed scrollbar timing: the hook marks a scroll container active
 * on `scroll` and clears it after {@link SCROLL_REVEAL_LINGER_MS}.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { SCROLL_REVEAL_LINGER_MS, attachScrollRevealScrollbar, useScrollRevealScrollbar } from '../src/useScrollRevealScrollbar.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Scrollport wired to the hook; exposes the active flag as a data attribute. */
function ScrollHost(): JSX.Element {
  const { ref, active } = useScrollRevealScrollbar()
  return (
    <div ref={ref} data-active={active ? 'true' : 'false'} style={{ overflow: 'auto', height: 40 }}>
      <div style={{ height: 200 }} />
    </div>
  )
}

describe('useScrollRevealScrollbar', () => {
  it('starts hidden and reveals on scroll until the linger elapses', () => {
    vi.useFakeTimers()
    const view = render(<ScrollHost />)
    const scroller = view.container.firstElementChild
    if (!(scroller instanceof HTMLElement)) throw new Error('scroll host not rendered')
    expect(scroller.getAttribute('data-active')).toBe('false')
    act(() => { fireEvent.scroll(scroller) })
    expect(scroller.getAttribute('data-active')).toBe('true')
    act(() => { vi.advanceTimersByTime(SCROLL_REVEAL_LINGER_MS - 1) })
    expect(scroller.getAttribute('data-active')).toBe('true')
    act(() => { vi.advanceTimersByTime(1) })
    expect(scroller.getAttribute('data-active')).toBe('false')
  })

  it('extends the linger while scrolling continues', () => {
    vi.useFakeTimers()
    const view = render(<ScrollHost />)
    const scroller = view.container.firstElementChild
    if (!(scroller instanceof HTMLElement)) throw new Error('scroll host not rendered')
    act(() => { fireEvent.scroll(scroller) })
    act(() => { vi.advanceTimersByTime(500) })
    act(() => { fireEvent.scroll(scroller) })
    act(() => { vi.advanceTimersByTime(SCROLL_REVEAL_LINGER_MS - 1) })
    expect(scroller.getAttribute('data-active')).toBe('true')
    act(() => { vi.advanceTimersByTime(1) })
    expect(scroller.getAttribute('data-active')).toBe('false')
  })

  it('clears a pending linger on unmount', () => {
    vi.useFakeTimers()
    const view = render(<ScrollHost />)
    const scroller = view.container.firstElementChild
    if (!(scroller instanceof HTMLElement)) throw new Error('scroll host not rendered')
    act(() => { fireEvent.scroll(scroller) })
    cleanup()
    expect(() => { vi.advanceTimersByTime(SCROLL_REVEAL_LINGER_MS) }).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('attachScrollRevealScrollbar', () => {
  it('reveals on scroll and hides after linger', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    let active = false
    const dispose = attachScrollRevealScrollbar(host, (next) => { active = next })
    expect(active).toBe(false)
    host.dispatchEvent(new Event('scroll'))
    expect(active).toBe(true)
    vi.advanceTimersByTime(SCROLL_REVEAL_LINGER_MS)
    expect(active).toBe(false)
    dispose()
  })
})
