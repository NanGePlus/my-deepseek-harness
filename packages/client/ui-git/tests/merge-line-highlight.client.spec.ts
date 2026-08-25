import { describe, expect, it } from 'vitest'
import { mergeLineHighlight } from '../src/client/merge-line-highlight.ts'

describe('mergeLineHighlight', () => {
  it('returns plain text when neither syntax nor diff spans apply', () => {
    expect(mergeLineHighlight('hello', undefined, undefined)).toEqual([
      { text: 'hello', charKind: 'same' },
    ])
  })

  it('keeps syntax colors on unchanged lines', () => {
    const merged = mergeLineHighlight('const x = 1', [
      { text: 'const', style: { color: 'var(--shiki-token-keyword)' } },
      { text: ' x = 1', style: { color: 'var(--shiki-token-constant)' } },
    ], undefined)
    expect(merged).toEqual([
      { text: 'const', style: { color: 'var(--shiki-token-keyword)' }, charKind: 'same' },
      { text: ' x = 1', style: { color: 'var(--shiki-token-constant)' }, charKind: 'same' },
    ])
  })

  it('applies diff classes inside syntax-colored segments', () => {
    const merged = mergeLineHighlight('abc', [
      { text: 'a', style: { color: 'red' } },
      { text: 'bc', style: { color: 'blue' } },
    ], [
      { kind: 'same', text: 'a' },
      { kind: 'insert', text: 'bc' },
    ])
    expect(merged).toEqual([
      { text: 'a', style: { color: 'red' }, charKind: 'same' },
      { text: 'bc', style: { color: 'blue' }, charKind: 'insert' },
    ])
  })

  it('splits one syntax span across diff boundaries', () => {
    const merged = mergeLineHighlight('abcd', [
      { text: 'abcd', style: { color: 'green' } },
    ], [
      { kind: 'same', text: 'ab' },
      { kind: 'delete', text: 'cd' },
    ])
    expect(merged).toEqual([
      { text: 'ab', style: { color: 'green' }, charKind: 'same' },
      { text: 'cd', style: { color: 'green' }, charKind: 'delete' },
    ])
  })
})
