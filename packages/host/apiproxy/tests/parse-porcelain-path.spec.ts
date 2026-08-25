import { describe, expect, it } from 'vitest'
import {
  isGitUiVisibleRelativePath,
  normalizePorcelainRelativePath,
  parsePorcelainPath,
} from '../src/git-status.ts'

describe('parsePorcelainPath', () => {
  it('returns unquoted paths unchanged', () => {
    expect(parsePorcelainPath('src/a.ts')).toBe('src/a.ts')
  })

  it('decodes quoted escapes and UTF-8 octal bytes', () => {
    expect(parsePorcelainPath('"others/\\345\\237\\272\\347\\233\\256\\345\\275\\225/file.txt"'))
      .toBe('others/基目录/file.txt')
  })

  it('uses the destination path on rename rows', () => {
    expect(parsePorcelainPath('old.ts -> "new/\\344\\270\\255.txt"')).toBe('new/中.txt')
  })
})

describe('normalizePorcelainRelativePath', () => {
  it('maps Windows separators after unquoting', () => {
    expect(normalizePorcelainRelativePath('src\\nested\\a.ts')).toBe('src/nested/a.ts')
  })
})

describe('isGitUiVisibleRelativePath', () => {
  it('hides .DS_Store at any depth', () => {
    expect(isGitUiVisibleRelativePath('.DS_Store')).toBe(false)
    expect(isGitUiVisibleRelativePath('others/.DS_Store')).toBe(false)
    expect(isGitUiVisibleRelativePath('src/a.ts')).toBe(true)
  })
})
