import { describe, expect, it } from 'vitest'
import { breadcrumbSegments, extnameOf, fileNameOf, isMarkdownLanguage, languageForPath, languageLabel, MONACO_HOVER_LANGUAGE_IDS, openKindForPath } from '../src/client/open-kind.ts'

describe('open-kind', () => {
  it('classifies image, known-binary, and everything else', () => {
    expect(openKindForPath('/w/a.PNG')).toBe('preview')
    expect(openKindForPath('/w/a.wasm')).toBe('non-openable')
    expect(openKindForPath('/w/a.ts')).toBe('text')
  })

  it('names the last path segment and treats a trailing separator as the original path', () => {
    expect(fileNameOf('/w/alpha/README.md')).toBe('README.md')
    expect(fileNameOf('README.md')).toBe('README.md')
    expect(fileNameOf('/w/alpha/')).toBe('/w/alpha/')
  })

  it('treats dotfiles and extensionless names as having no extension', () => {
    expect(extnameOf('/w/.gitignore')).toBe('')
    expect(extnameOf('/w/Makefile')).toBe('')
    expect(extnameOf('/w/app.TS')).toBe('.ts')
  })

  it('maps Dockerfile, Makefile, known extensions, and unknown names to language ids', () => {
    expect(languageForPath('/w/Dockerfile')).toBe('dockerfile')
    expect(languageForPath('/w/Makefile')).toBe('plaintext')
    expect(languageForPath('/w/app.ts')).toBe('typescript')
    expect(languageForPath('/w/notes.unknown')).toBe('plaintext')
  })

  it('labels known language ids and echoes unknown ids', () => {
    expect(languageLabel('markdown')).toBe('Markdown')
    expect(languageLabel('made-up')).toBe('made-up')
  })

  it('detects Markdown language and builds workspace-relative breadcrumbs', () => {
    expect(isMarkdownLanguage('markdown')).toBe(true)
    expect(isMarkdownLanguage('typescript')).toBe(false)
    expect(breadcrumbSegments('/w/alpha', '/w/alpha/apps/cli/README.zh.md'))
      .toEqual(['apps', 'cli', 'README.zh.md'])
    expect(breadcrumbSegments(undefined, '/else/README.md')).toEqual(['README.md'])
  })

  it('lists every editable Monaco language id for LSP hover registration', () => {
    expect(MONACO_HOVER_LANGUAGE_IDS).toContain('python')
    expect(MONACO_HOVER_LANGUAGE_IDS).toContain('json')
    expect(MONACO_HOVER_LANGUAGE_IDS).toContain('yaml')
    expect(MONACO_HOVER_LANGUAGE_IDS).toContain('plaintext')
  })
})
