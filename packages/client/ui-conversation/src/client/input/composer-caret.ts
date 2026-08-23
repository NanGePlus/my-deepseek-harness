/** CustomEvent name for out-of-band composer caret placement (Add to Chat). */
export const COMPOSER_CARET_EVENT = 'dsh:composer-caret'

/** Payload for {@link COMPOSER_CARET_EVENT}. */
export interface ComposerCaretDetail {
  caret: number
}

/** Pending composer caret requests from out-of-band draft inserts (Add to Chat). */

let pendingComposerCaret: number | null = null

/**
 * Queue one caret offset for the next InputBar layout pass.
 * @param caret - draft offset for a collapsed selection.
 */
export function scheduleComposerCaret(caret: number): void {
  pendingComposerCaret = caret
}

/**
 * Consume one queued caret offset, if any.
 * @returns the queued offset, or null when none is pending.
 */
export function takePendingComposerCaret(): number | null {
  const caret = pendingComposerCaret
  pendingComposerCaret = null
  return caret
}
