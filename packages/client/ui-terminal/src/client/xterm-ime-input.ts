/**
 * IME helpers for xterm stdin forwarding.
 * Suppresses PTY traffic during active composition and collapses pinyin spacing.
 */

/**
 * Collapse IME pinyin spacing such as `l s` into `ls` while preserving real words.
 * @param data - committed or direct stdin text.
 */
export function collapseImeLatinSpacing(data: string): string {
  if (!data.includes(' ')) return data
  const parts = data.split(' ')
  if (parts.length > 1 && parts.every(part => part.length === 1 && /[a-zA-Z]/.test(part))) {
    return parts.join('')
  }
  return data
}

/** Hooks composition events on the xterm textarea to gate PTY forwarding. */
export interface XtermImeGate {
  /** True while the OS IME composition session is active. */
  isComposing(): boolean
  /** Remove textarea listeners. */
  dispose(): void
}

/**
 * Attach composition listeners to one xterm textarea.
 * @param textarea - hidden input owned by xterm.js.
 */
export function attachXtermImeGate(textarea: HTMLTextAreaElement): XtermImeGate {
  let composing = false
  const onStart = (): void => { composing = true }
  const onEnd = (): void => { composing = false }
  textarea.addEventListener('compositionstart', onStart)
  textarea.addEventListener('compositionend', onEnd)
  return {
    isComposing: () => composing,
    dispose: () => {
      textarea.removeEventListener('compositionstart', onStart)
      textarea.removeEventListener('compositionend', onEnd)
    },
  }
}

/**
 * Forward xterm stdin to the PTY unless IME composition is active.
 * @param data - raw onData payload.
 * @param isComposing - active composition gate.
 * @param forward - filtered PTY write callback.
 */
export function forwardXtermInputWhenIdle(
  data: string,
  isComposing: () => boolean,
  forward: (data: string) => void,
): void {
  if (isComposing()) return
  forward(data)
}
