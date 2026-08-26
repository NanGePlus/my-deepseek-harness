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
 * @param options - When `force` is true, reload even while focused (external disk wins).
 */
export function shouldSyncMonacoBuffer(
  value: string,
  lastEmitted: string,
  state: MonacoBufferSyncState,
  options: { force?: boolean } = {},
): boolean {
  if (value === lastEmitted) return false
  if (state.composing) return false
  if (!options.force && state.focused) return false
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

/**
 * Whether {@link diskReloadTicket} requires a forced buffer apply while focused.
 * @param diskReloadTicket - Current tab reload generation from props.
 * @param lastDiskReloadTicket - Last generation applied to the live editor.
 */
export function monacoDiskReloadForce(
  diskReloadTicket: number,
  lastDiskReloadTicket: number,
): boolean {
  return diskReloadTicket !== lastDiskReloadTicket
}

/**
 * Decide whether an incoming buffer prop should replace the live editor model.
 * Does not consume {@link diskReloadTicket}; call {@link markMonacoBufferPropApplied} after apply.
 * @param value - Buffer from props.
 * @param diskReloadTicket - Current tab reload generation from props.
 * @param lastEmitted - Last markdown/text written upstream from the editor.
 * @param lastDiskReloadTicket - Last reload generation applied to the live editor.
 * @param state - Focus and IME composition flags.
 */
export function planMonacoBufferPropApply(
  value: string,
  diskReloadTicket: number,
  lastEmitted: { current: string },
  lastDiskReloadTicket: { current: number },
  state: MonacoBufferSyncState,
): { force: boolean; shouldApply: boolean } {
  const force = monacoDiskReloadForce(diskReloadTicket, lastDiskReloadTicket.current)
  return {
    force,
    shouldApply: shouldSyncMonacoBuffer(value, lastEmitted.current, state, { force }),
  }
}

/**
 * Record a successful buffer apply from props, consuming a forced disk reload when needed.
 * @param value - Applied buffer text.
 * @param diskReloadTicket - Current tab reload generation from props.
 * @param force - Whether this apply satisfied a forced disk reload.
 * @param lastEmitted - Last markdown/text written upstream from the editor.
 * @param lastDiskReloadTicket - Last reload generation applied to the live editor.
 */
export function markMonacoBufferPropApplied(
  value: string,
  diskReloadTicket: number,
  force: boolean,
  lastEmitted: { current: string },
  lastDiskReloadTicket: { current: number },
): void {
  lastEmitted.current = value
  if (force) lastDiskReloadTicket.current = diskReloadTicket
}
