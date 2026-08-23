/** Guards for syncing Monaco buffer props without clobbering live IME edits. */

/** Live editor signals used when deciding whether props may reload the model. */
export interface MonacoBufferSyncState {
  /** True while the OS IME composition session is active. */
  composing: boolean
  /** True while the Monaco surface (or fallback textarea) has focus. */
  focused: boolean
}

/**
 * Returns true when an incoming buffer prop should replace the Monaco model.
 * @param value - Buffer from props.
 * @param lastEmitted - Last markdown/text written upstream from the editor.
 * @param state - Focus and IME composition flags.
 */
export function shouldSyncMonacoBuffer(
  value: string,
  lastEmitted: string,
  state: MonacoBufferSyncState,
): boolean {
  if (value === lastEmitted) return false
  if (state.composing || state.focused) return false
  return true
}

/**
 * Push the current editor text into the shared buffer callback.
 * @param next - Latest model text.
 * @param onChange - Parent buffer callback.
 * @param lastEmitted - Tracks the last value written upstream.
 */
export function emitMonacoBuffer(
  next: string,
  onChange: (value: string) => void,
  lastEmitted: { current: string },
): void {
  lastEmitted.current = next
  onChange(next)
}
