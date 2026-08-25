import { describe, expect, it } from 'vitest'
import { fileIconUrlForPath } from '../src/client/file-icon.ts'

describe('git panel file icons', () => {
  it('resolves a Material Icon Theme URL from the relative path basename', () => {
    const url = fileIconUrlForPath('src/app.ts')
    expect(url.startsWith('/material-icons/')).toBe(true)
    expect(url.endsWith('.svg')).toBe(true)
  })

  it('falls back to the generic file glyph', () => {
    expect(fileIconUrlForPath('')).toBe('/material-icons/file.svg')
  })
})
