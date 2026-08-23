/** Insert file line-range references into the session composer draft. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  buildFileContextReferenceInsert,
  FILE_CONTEXT_SOURCE,
  type FileContextRefRequest,
} from './file-context-ref.ts'

/** Document event for requesting composer caret placement after an out-of-band insert. */
export const COMPOSER_CARET_EVENT = 'dsh:composer-caret'

/**
 * Focus the active session composer textarea and place the caret.
 * @param caret - draft offset for the collapsed selection.
 */
export function focusComposerTextareaAt(caret: number): void {
  document.dispatchEvent(new CustomEvent(COMPOSER_CARET_EVENT, { detail: { caret } }))
  const textarea = document.querySelector('[data-composer-card] textarea:not([disabled])')
  if (!(textarea instanceof HTMLTextAreaElement)) return
  textarea.focus({ preventScroll: true })
}

/**
 * Append one file line-range chip to the session composer draft.
 * @param actx - session-scope client context.
 * @param conversation - conversation service for the bound session.
 * @param request - file path and one-based line range.
 */
export function insertFileContextIntoComposer(
  actx: ClientContext,
  conversation: IConversation,
  request: FileContextRefRequest,
): boolean {
  const input = conversation.input.for(actx)
  let snapshot = input.state.getSnapshot()
  if (snapshot.phase !== 'plain' && snapshot.phase !== 'claimed') return false

  let draft = snapshot.draft
  if (draft.length > 0 && !/\s/u.test(draft[draft.length - 1] ?? '')) {
    input.setDraft(`${draft} `)
    snapshot = input.state.getSnapshot()
    draft = snapshot.draft
  }

  const span = {
    start: draft.length,
    end: draft.length,
    draftRev: snapshot.draftRev,
  }
  const reference = buildFileContextReferenceInsert(request)
  const inserted = actx.bail(actx, 'slash/input-insert-reference', { reference, span }) === true
  if (inserted) {
    const snap = input.state.getSnapshot()
    const chip = [...snap.occurrences].reverse().find(o => o.source === FILE_CONTEXT_SOURCE)
    const chipEnd = chip === undefined
      ? snap.draft.length
      : chip.offset + (chip.spanLength ?? chip.label.length)
    // Park after the trailing space so the caret sits outside the pill fill.
    focusComposerTextareaAt(snap.draft[chipEnd] === ' ' ? chipEnd + 1 : chipEnd)
  }
  return inserted
}
