/** Scroll-reveal scrollbar wiring for the xterm viewport inside one host element. */

/** How long the xterm scrollbar stays drawn after scrolling stops. */
const SCROLL_REVEAL_LINGER_MS = 800

/**
 * Reveal one scroll container's themed thumb only while the user scrolls.
 * @param element - scroll container.
 * @param onActiveChange - called when the thumb should show or hide.
 * @returns disposer that removes listeners and clears pending linger.
 */
function attachScrollRevealScrollbar(
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
 * Hide the xterm viewport scrollbar until the user scrolls.
 * @param host - TerminalPanel viewport host that carries scroll-reveal CSS vars.
 * @returns disposer, or a no-op when the viewport is not mounted yet.
 */
export function attachXtermHostScrollReveal(host: HTMLElement): () => void {
  const viewportEl = host.querySelector('.xterm-viewport')
  if (!(viewportEl instanceof HTMLElement)) return () => {}
  return attachScrollRevealScrollbar(viewportEl, (active) => {
    if (active) host.setAttribute('data-dsh-scroll-reveal-active', '')
    else host.removeAttribute('data-dsh-scroll-reveal-active')
  })
}
