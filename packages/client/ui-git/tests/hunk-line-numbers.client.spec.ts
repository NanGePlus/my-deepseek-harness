import { describe, expect, it } from 'vitest'
import { lineNumbersForHunk, parseHunkHeader } from '../src/client/hunk-line-numbers.ts'

describe('parseHunkHeader', () => {
  it('reads old and new start lines', () => {
    expect(parseHunkHeader('@@ -18,7 +18,7 @@ context')).toEqual({ oldStart: 18, newStart: 18 })
  })
})

describe('lineNumbersForHunk', () => {
  it('numbers deletions, additions, and context separately', () => {
    const numbers = lineNumbersForHunk('@@ -10,3 +10,4 @@', [
      { origin: 'context', text: 'keep' },
      { origin: 'del', text: 'old' },
      { origin: 'add', text: 'new' },
      { origin: 'context', text: 'tail' },
    ])
    expect(numbers).toEqual([10, 11, 11, 12])
  })
})
