import { describe, expect, it } from 'vitest'
import { charDiffPair } from '../src/client/inline-char-diff.ts'

describe('charDiffPair', () => {
  it('highlights only the changed middle of one modified line pair', () => {
    const { old, new: next } = charDiffPair('hello world', 'hello there')
    expect(old).toEqual([
      { kind: 'same', text: 'hello ' },
      { kind: 'delete', text: 'world' },
    ])
    expect(next).toEqual([
      { kind: 'same', text: 'hello ' },
      { kind: 'insert', text: 'there' },
    ])
  })

  it('highlights a fully replaced line', () => {
    const { old, new: next } = charDiffPair('cat', 'dog')
    expect(old).toEqual([{ kind: 'delete', text: 'cat' }])
    expect(next).toEqual([{ kind: 'insert', text: 'dog' }])
  })

  it('returns one same span when the lines match', () => {
    expect(charDiffPair('same', 'same')).toEqual({
      old: [{ kind: 'same', text: 'same' }],
      new: [{ kind: 'same', text: 'same' }],
    })
  })
})
