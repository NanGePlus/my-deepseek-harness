/** Visible draft-token chip edit normalization for the composer DOM layer. */

import type { EditRange, Occurrence } from './contract.ts'
import { occurrenceSpanLength } from './contract.ts'

/** Occurrences whose draft span is longer than one U+FFFC placeholder. */
export function visibleChipOccurrences(occurrences: readonly Occurrence[]): Occurrence[] {
  return occurrences.filter(o => occurrenceSpanLength(o) > 1)
}

/**
 * Recover one contiguous edit from a previous and next draft.
 * @param prevDraft - draft before the DOM edit.
 * @param nextDraft - draft after the DOM edit.
 */
export function diffContiguousEdit(prevDraft: string, nextDraft: string): EditRange | null {
  if (prevDraft === nextDraft) return null
  let start = 0
  const minLen = Math.min(prevDraft.length, nextDraft.length)
  while (start < minLen && prevDraft[start] === nextDraft[start]) start += 1
  let prevEnd = prevDraft.length
  let nextEnd = nextDraft.length
  while (prevEnd > start && nextEnd > start && prevDraft[prevEnd - 1] === nextDraft[nextEnd - 1]) {
    prevEnd -= 1
    nextEnd -= 1
  }
  const insertedLength = nextEnd - start
  const expected = prevDraft.slice(0, start) + nextDraft.slice(start, nextEnd) + prevDraft.slice(prevEnd)
  if (expected !== nextDraft) return null
  return { start, end: prevEnd, insertedLength }
}

/**
 * When a DOM edit partially intersects a visible draft-token chip, expand the
 * edit to remove the whole chip atomically.
 * @param prevDraft - draft before the DOM edit.
 * @param nextDraft - draft after the DOM edit.
 * @param occurrences - published occurrence table.
 */
export function expandVisibleChipEdit(
  prevDraft: string,
  nextDraft: string,
  occurrences: readonly Occurrence[],
): { draft: string; editRange: EditRange; caret: number } | null {
  const chips = visibleChipOccurrences(occurrences)
  if (chips.length === 0) return null
  const edit = diffContiguousEdit(prevDraft, nextDraft)
  if (edit === null) return null

  const { start: delStart, end: delEnd, insertedLength } = edit
  if (insertedLength > 0) {
    // Typing or pasting into a visible chip removes the chip identity — drop the whole span.
    let expandStart = delStart
    let expandEnd = delEnd
    let expanded = false
    for (const o of chips) {
      const oEnd = o.offset + occurrenceSpanLength(o)
      const intersects = o.offset < delEnd && oEnd > delStart
      if (intersects) {
        expandStart = Math.min(expandStart, o.offset)
        expandEnd = Math.max(expandEnd, oEnd)
        expanded = true
      }
    }
    if (!expanded) return null
    const draft = prevDraft.slice(0, expandStart) + nextDraft.slice(delStart, delStart + insertedLength)
      + prevDraft.slice(expandEnd)
    const caret = expandStart + insertedLength
    return {
      draft,
      editRange: { start: expandStart, end: expandEnd, insertedLength: caret - expandStart },
      caret,
    }
  }

  let expandStart = delStart
  let expandEnd = delEnd
  let expanded = false
  for (const o of chips) {
    const oEnd = o.offset + occurrenceSpanLength(o)
    const intersects = o.offset < delEnd && oEnd > delStart
    const fullyDeleted = delStart <= o.offset && delEnd >= oEnd
    if (intersects && !fullyDeleted) {
      expandStart = Math.min(expandStart, o.offset)
      expandEnd = Math.max(expandEnd, oEnd)
      expanded = true
    }
  }
  if (!expanded) return null
  const draft = prevDraft.slice(0, expandStart) + prevDraft.slice(expandEnd)
  return {
    draft,
    editRange: { start: expandStart, end: expandEnd, insertedLength: 0 },
    caret: expandStart,
  }
}

/**
 * Draft offset just after a visible chip, past a following space when present.
 * A caret parked at the chip end sits on the pill's right ink; the space is
 * the type-here seat outside the fill.
 * @param draft - live composer draft.
 * @param occurrence - chip whose span is [offset, offset+spanLength).
 */
export function caretAfterVisibleChip(
  draft: string,
  occurrence: Pick<Occurrence, 'offset' | 'spanLength'>,
): number {
  const oEnd = occurrence.offset + occurrenceSpanLength(occurrence)
  return draft[oEnd] === ' ' ? oEnd + 1 : oEnd
}

/**
 * Move a collapsed caret or an partial chip selection out of visible chip interiors.
 * A caret at the chip end steps onto the trailing space so it sits outside the pill.
 * @param draft - live composer draft.
 * @param occurrences - published occurrence table.
 * @param start - selection start.
 * @param end - selection end.
 */
export function normalizeComposerSelection(
  draft: string,
  occurrences: readonly Occurrence[],
  start: number,
  end: number,
): { start: number; end: number } {
  return snapSelectionOutsideVisibleChips(occurrences, start, end, draft)
}

/**
 * Move a collapsed caret or an partial chip selection out of visible chip interiors.
 * @param occurrences - published occurrence table.
 * @param start - selection start.
 * @param end - selection end.
 * @param draft - live composer draft; used to step past a trailing space.
 */
export function snapSelectionOutsideVisibleChips(
  occurrences: readonly Occurrence[],
  start: number,
  end: number,
  draft = '',
): { start: number; end: number } {
  const chips = visibleChipOccurrences(occurrences)
  if (chips.length === 0) return { start, end }

  if (start !== end) {
    let expandStart = start
    let expandEnd = end
    let expanded = false
    for (const o of chips) {
      const oEnd = o.offset + occurrenceSpanLength(o)
      const overlaps = o.offset < end && oEnd > start
      const fullyContains = start <= o.offset && end >= oEnd
      if (overlaps && !fullyContains) {
        expandStart = Math.min(expandStart, o.offset)
        expandEnd = Math.max(expandEnd, oEnd)
        expanded = true
      }
    }
    return expanded ? { start: expandStart, end: expandEnd } : { start, end }
  }

  for (const o of chips) {
    const oEnd = o.offset + occurrenceSpanLength(o)
    const after = caretAfterVisibleChip(draft, o)
    if (start > o.offset && start < oEnd) {
      const toStart = start - o.offset
      const toEnd = oEnd - start
      const snap = toStart <= toEnd ? o.offset : after
      return { start: snap, end: snap }
    }
    if (start === oEnd && after !== oEnd) {
      return { start: after, end: after }
    }
  }
  return { start, end }
}

/**
 * Skip arrow-key caret movement over a visible chip span instead of through it.
 * @param occurrences - published occurrence table.
 * @param pos - caret offset before the arrow key.
 * @param direction - horizontal arrow direction.
 * @param draft - live composer draft; used to land past a trailing space.
 */
export function skipArrowOverVisibleChips(
  occurrences: readonly Occurrence[],
  pos: number,
  direction: 'left' | 'right',
  draft = '',
): number | null {
  for (const o of visibleChipOccurrences(occurrences)) {
    const oEnd = o.offset + occurrenceSpanLength(o)
    const after = caretAfterVisibleChip(draft, o)
    if (direction === 'left') {
      if (pos === after || pos === oEnd || (pos > o.offset && pos <= oEnd)) return o.offset
    } else if (pos >= o.offset && pos < after) {
      return after
    }
  }
  return null
}

/**
 * Find the visible chip occurrence strictly containing one draft offset.
 * @param occurrences - published occurrence table.
 * @param offset - draft offset (interior only).
 */
export function visibleChipAtInteriorOffset(
  occurrences: readonly Occurrence[],
  offset: number,
): Occurrence | undefined {
  return visibleChipOccurrences(occurrences).find((o) => {
    const oEnd = o.offset + occurrenceSpanLength(o)
    return offset > o.offset && offset < oEnd
  })
}

/**
 * Find the visible chip occurrence whose draft span contains one offset.
 * @param occurrences - published occurrence table.
 * @param offset - draft offset (chip span is [offset, offset+spanLength)).
 */
export function visibleChipContainingOffset(
  occurrences: readonly Occurrence[],
  offset: number,
): Occurrence | undefined {
  return visibleChipOccurrences(occurrences).find((o) => {
    const oEnd = o.offset + occurrenceSpanLength(o)
    return offset >= o.offset && offset < oEnd
  })
}

/**
 * Map one viewport point to a draft offset inside a textarea.
 * @param textarea - composer textarea.
 * @param clientX - viewport X coordinate.
 * @param clientY - viewport Y coordinate.
 */
export function caretOffsetFromPoint(
  textarea: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number | null {
  const doc = textarea.ownerDocument
  const fromCaretPosition = doc.caretPositionFromPoint?.(clientX, clientY)
  if (fromCaretPosition != null && fromCaretPosition.offsetNode === textarea) {
    return fromCaretPosition.offset
  }
  const fromRange = doc.caretRangeFromPoint?.(clientX, clientY)
  if (fromRange != null && fromRange.startContainer === textarea) {
    return fromRange.startOffset
  }
  return null
}
