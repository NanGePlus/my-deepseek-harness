// Scroll-revealed scrollbars: the thumb stays transparent until the user
// scrolls, then lingers briefly after motion stops. Surfaces rebind
// ui-theme's --dsh-scrollbar-thumb{,-hover} pair through a CSS-module
// active class driven by this hook.

import { useCallback, useEffect, useState } from 'react'

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
 * Attach scroll-reveal timing to one scroll container.
 * @param element - scroll container.
 * @param onActiveChange - called when the thumb should show or hide.
 * @returns disposer that removes listeners and clears pending linger.
 */
export function attachScrollRevealScrollbar(
  element: HTMLElement,
  onActiveChange: (active: boolean) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = (): void => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }
  const reveal = (): void => {
    onActiveChange(true)
    cancel()
    timer = setTimeout(() => {
      timer = null
      onActiveChange(false)
    }, SCROLL_REVEAL_LINGER_MS)
  }
  const onScroll = (): void => { reveal() }
  element.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    element.removeEventListener('scroll', onScroll)
    cancel()
    onActiveChange(false)
  }
}

/**
 * Reveal a scroll container's themed thumb only while the user is scrolling.
 * @returns the scroll container ref and whether its active class should apply.
 */
export function useScrollRevealScrollbar(): ScrollRevealScrollbar {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [active, setActive] = useState(false)

  const ref = useCallback((next: HTMLElement | null): void => {
    setElement(next)
  }, [])

  useEffect(() => {
    if (element === null) return
    return attachScrollRevealScrollbar(element, setActive)
  }, [element])

  return { ref, active }
}
