/**
 * Normalize Host scrollback before xterm replay.
 * zsh PROMPT_EOL_MARK prints an inverse-video `%`, pads to the PTY width, then `\r`.
 * Replayed at the wrong width (or before xterm has reflowed) those bytes render as
 * standalone `%` lines above each prompt.
 */

/** One SGR / CSI-m sequence (`ESC[…m`). */
const SGR = '(?:\\x1b\\[[0-9;]*m)'

/**
 * zsh PROMPT_SP / PROMPT_EOL_MARK as captured from a login zsh PTY:
 * `ESC[1m ESC[7m % ESC[27m ESC[1m ESC[0m` + pad spaces + `\r \r\r`.
 * The previous regex required `ESC[7m%ESC[0m` and missed this sequence.
 */
const ZSH_PROMPT_SP_MARK = new RegExp(`${SGR}+%${SGR}+ *\\r(?: ?\\r)*`, 'g')

/**
 * Strip zsh end-of-line marks from one scrollback snapshot so reconnect replay
 * does not leave inverse-video `%` rows above prompts.
 * @param text - raw Host scrollback bytes.
 */
export function sanitizeTerminalScrollbackForReplay(text: string): string {
  return text.replace(ZSH_PROMPT_SP_MARK, '')
}

/**
 * Wait until the viewport host has layout and FitAddon can return cols/rows.
 * @param fit - callback that reflows xterm and returns the active size.
 * @param host - mounted xterm host element.
 * @param signal - aborts waiting when the stream disconnects.
 */
export async function waitForXtermViewportFit(
  fit: () => { cols: number; rows: number } | null,
  host: HTMLElement,
  signal: AbortSignal,
): Promise<{ cols: number; rows: number } | null> {
  const tryFit = (): { cols: number; rows: number } | null => {
    if (host.clientWidth === 0 || host.clientHeight === 0) return null
    return fit()
  }

  const immediate = tryFit()
  if (immediate !== null) return immediate
  if (signal.aborted) return null

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: { cols: number; rows: number } | null): void => {
      if (settled) return
      settled = true
      observer?.disconnect()
      signal.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const onAbort = (): void => { finish(null) }
    signal.addEventListener('abort', onAbort)

    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const dims = tryFit()
        if (dims !== null) finish(dims)
      })
      observer.observe(host)
    }

    let attempts = 0
    const poll = (): void => {
      if (signal.aborted) {
        finish(null)
        return
      }
      const dims = tryFit()
      if (dims !== null) {
        finish(dims)
        return
      }
      attempts += 1
      if (attempts >= 120) {
        finish(null)
        return
      }
      requestAnimationFrame(poll)
    }
    requestAnimationFrame(poll)
  })
}
