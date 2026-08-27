import { describe, expect, it } from 'vitest'
import { changeKindLetter, splitChangePath } from '../src/client/change-path-label.ts'

describe('splitChangePath', () => {
  it('keeps root-level files on the file name only', () => {
    expect(splitChangePath('CONTEXT.md')).toEqual({ fileName: 'CONTEXT.md', parentDir: '' })
  })

  it('splits nested repository-relative paths', () => {
    expect(splitChangePath('docs/adr/0001-python-stdlib-only.md')).toEqual({
      fileName: '0001-python-stdlib-only.md',
      parentDir: 'docs/adr',
    })
  })
})

describe('changeKindLetter', () => {
  it('maps working-tree kinds to Git letters', () => {
    expect(changeKindLetter('modified')).toBe('M')
    expect(changeKindLetter('untracked')).toBe('U')
    expect(changeKindLetter('deleted')).toBe('D')
  })
})
