import { describe, expect, it } from 'vitest'
import { languageHintForPath } from '../src/client/diff-preview-language.ts'

describe('languageHintForPath', () => {
  it('maps common source extensions to shiki hints', () => {
    expect(languageHintForPath('src/app.ts')).toBe('ts')
    expect(languageHintForPath('src/App.tsx')).toBe('tsx')
    expect(languageHintForPath('script.py')).toBe('py')
    expect(languageHintForPath('README.md')).toBe('md')
  })

  it('returns undefined for dotfiles and unknown extensions', () => {
    expect(languageHintForPath('.gitignore')).toBeUndefined()
    expect(languageHintForPath('data.unknownext')).toBeUndefined()
    expect(languageHintForPath('foo.constructor')).toBeUndefined()
  })
})
