// Scroll-revealed scrollbars: the thumb stays transparent until the user
// scrolls, then lingers briefly after motion stops. Surfaces rebind
// ui-theme's --dsh-scrollbar-thumb{,-hover} pair through a CSS-module
// active class driven by this hook.

import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the scrollbar stays drawn after scrolling stops. */
export const SCROLL_REVEAL_LINGER_MS = 800

/** Callback ref plus the active class the scroll container should carry. */
export interface ScrollRevealScrollbar {
  /** Callback ref for the scroll container. */
  ref: (element: HTMLElement | null) => void
  /** True while the scrollbar thumb should be drawn. */
  active: boolean
}

/**
 * Reveal a scroll container's themed thumb only while the user is scrolling.
 * @returns the scroll container ref and whether its active class should apply.
 */
export function useScrollRevealScrollbar(): ScrollRevealScrollbar {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback((): void => {
    if (timerRef.current === null) return
    clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const reveal = useCallback((): void => {
    setActive(true)
    cancel()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setActive(false)
    }, SCROLL_REVEAL_LINGER_MS)
  }, [cancel])

  const ref = useCallback((next: HTMLElement | null): void => {
    setElement(next)
  }, [])

  useEffect(() => {
    if (element === null) return
    const onScroll = (): void => { reveal() }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      cancel()
    }
  }, [element, reveal, cancel])

  useEffect(() => cancel, [cancel])

  return { ref, active }
}
