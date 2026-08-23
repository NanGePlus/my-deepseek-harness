import { describe, expect, it } from 'vitest'
import type { Occurrence } from '../src/client/input/contract.ts'
import { caretAfterVisibleChip, diffContiguousEdit, expandVisibleChipEdit, normalizeComposerSelection, skipArrowOverVisibleChips, snapSelectionOutsideVisibleChips, visibleChipContainingOffset } from '../src/client/input/chip-edit.ts'

const TOKEN = 'CONTEXT.md (19-21)'

function visibleOcc(offset: number): Occurrence {
  return {
    occurrenceId: 1,
    source: 'file-context',
    ref: '{}',
    offset,
    spanLength: TOKEN.length,
    label: TOKEN,
    clipboardText: TOKEN,
  }
}

describe('caretAfterVisibleChip', () => {
  it('steps past a trailing space and stays at the span end when none follows', () => {
    const chip = visibleOcc(0)
    expect(caretAfterVisibleChip(`${TOKEN} `, chip)).toBe(TOKEN.length + 1)
    expect(caretAfterVisibleChip(TOKEN, chip)).toBe(TOKEN.length)
  })
})

describe('normalizeComposerSelection', () => {
  it('snaps a collapsed caret out of a chip interior and leaves the chip end alone', () => {
    const chips = [visibleOcc(0)]
    const draft = TOKEN
    expect(normalizeComposerSelection(draft, chips, 5, 5)).toEqual({ start: 0, end: 0 })
    expect(normalizeComposerSelection(draft, chips, TOKEN.length, TOKEN.length)).toEqual({
      start: TOKEN.length,
      end: TOKEN.length,
    })
  })

  it('parks a caret at the chip end onto the trailing space', () => {
    const chips = [visibleOcc(0)]
    const draft = `${TOKEN} `
    expect(normalizeComposerSelection(draft, chips, TOKEN.length, TOKEN.length)).toEqual({
      start: TOKEN.length + 1,
      end: TOKEN.length + 1,
    })
  })
})

describe('snapSelectionOutsideVisibleChips', () => {
  it('snaps a collapsed caret out of a chip interior', () => {
    const chips = [visibleOcc(0)]
    expect(snapSelectionOutsideVisibleChips(chips, 5, 5)).toEqual({ start: 0, end: 0 })
    expect(snapSelectionOutsideVisibleChips(chips, TOKEN.length, TOKEN.length)).toEqual({
      start: TOKEN.length,
      end: TOKEN.length,
    })
  })
})

describe('skipArrowOverVisibleChips', () => {
  it('jumps over a visible chip span', () => {
    const chips = [visibleOcc(4)]
    expect(skipArrowOverVisibleChips(chips, 4 + TOKEN.length, 'left')).toBe(4)
    expect(skipArrowOverVisibleChips(chips, 4, 'right')).toBe(4 + TOKEN.length)
  })

  it('lands after the trailing space when jumping right', () => {
    const chips = [visibleOcc(0)]
    const draft = `${TOKEN} `
    expect(skipArrowOverVisibleChips(chips, 0, 'right', draft)).toBe(TOKEN.length + 1)
    expect(skipArrowOverVisibleChips(chips, TOKEN.length + 1, 'left', draft)).toBe(0)
  })
})

describe('expandVisibleChipEdit', () => {
  it('expands a single-character backspace inside a visible chip to the whole span', () => {
    const prev = `${TOKEN} `
    const next = `${TOKEN.slice(0, -1)} `
    const result = expandVisibleChipEdit(prev, next, [visibleOcc(0)])
    expect(result).toEqual({
      draft: ' ',
      editRange: { start: 0, end: TOKEN.length, insertedLength: 0 },
      caret: 0,
    })
  })

  it('leaves a trailing-space backspace untouched', () => {
    const prev = `${TOKEN} `
    const next = TOKEN
    expect(expandVisibleChipEdit(prev, next, [visibleOcc(0)])).toBeNull()
  })

  it('leaves a character typed at the chip end (on the trailing space) untouched', () => {
    const prev = `${TOKEN} `
    const next = `${TOKEN}x `
    expect(expandVisibleChipEdit(prev, next, [visibleOcc(0)])).toBeNull()
  })

  it('expands a partial selection delete across a visible chip', () => {
    const prev = `see ${TOKEN} now`
    const next = `see ${TOKEN.slice(0, 4)} now`
    const result = expandVisibleChipEdit(prev, next, [visibleOcc(4)])
    expect(result).toEqual({
      draft: 'see  now',
      editRange: { start: 4, end: 4 + TOKEN.length, insertedLength: 0 },
      caret: 4,
    })
  })

  it('ignores single-char placeholder chips', () => {
    const prev = 'see \uFFFC now'
    const next = 'see  now'
    expect(expandVisibleChipEdit(prev, next, [{
      occurrenceId: 1,
      source: 'subagent',
      ref: 'w1',
      offset: 4,
      spanLength: 1,
      label: '@w1',
      clipboardText: '@w1',
    }])).toBeNull()
  })
})

describe('visibleChipContainingOffset', () => {
  it('matches offsets inside the chip span', () => {
    const chips = [visibleOcc(0)]
    expect(visibleChipContainingOffset(chips, 0)).toBe(chips[0])
    expect(visibleChipContainingOffset(chips, 5)).toBe(chips[0])
    expect(visibleChipContainingOffset(chips, TOKEN.length - 1)).toBe(chips[0])
    expect(visibleChipContainingOffset(chips, TOKEN.length)).toBeUndefined()
  })
})

describe('diffContiguousEdit', () => {
  it('recovers one deletion range', () => {
    expect(diffContiguousEdit('abcdef', 'abdef')).toEqual({
      start: 2,
      end: 3,
      insertedLength: 0,
    })
  })
})
