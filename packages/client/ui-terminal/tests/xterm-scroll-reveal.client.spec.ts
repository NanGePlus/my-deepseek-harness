// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { SCROLL_REVEAL_LINGER_MS } from '@deepseek-ai/dsh-client-ui-primitives'
import { attachXtermHostScrollReveal } from '../src/client/xterm-scroll-reveal.ts'

describe('attachXtermHostScrollReveal', () => {
  it('reveals the host scrollbar while the xterm viewport scrolls', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const viewport = document.createElement('div')
    viewport.className = 'xterm-viewport'
    host.appendChild(viewport)
    const dispose = attachXtermHostScrollReveal(host)
    expect(host.hasAttribute('data-dsh-scroll-reveal-active')).toBe(false)
    viewport.dispatchEvent(new Event('scroll'))
    expect(host.hasAttribute('data-dsh-scroll-reveal-active')).toBe(true)
    vi.advanceTimersByTime(SCROLL_REVEAL_LINGER_MS)
    expect(host.hasAttribute('data-dsh-scroll-reveal-active')).toBe(false)
    dispose()
    vi.useRealTimers()
  })

  it('no-ops when the viewport is not mounted', () => {
    const host = document.createElement('div')
    expect(() => { attachXtermHostScrollReveal(host)() }).not.toThrow()
  })
})
