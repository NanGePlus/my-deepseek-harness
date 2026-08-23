import { describe, expect, it } from 'vitest'
import {
  hasLongLine,
  monacoOptionsForContent,
  monacoSurfaceOptionsForLanguage,
  MONACO_LONG_LINE_CHARS,
  shouldSkipLsp,
  utf8ByteLength,
} from '../src/client/editor-file-policy.ts'

describe('editor-file-policy', () => {
  it('detects long single lines typical of minified bundles', () => {
    const minified = 'x'.repeat(MONACO_LONG_LINE_CHARS + 1)
    expect(hasLongLine(minified)).toBe(true)
    expect(hasLongLine('short\nline\n')).toBe(false)
  })

  it('skips LSP for long lines and very large buffers', () => {
    expect(shouldSkipLsp('a\nb\n')).toBe(false)
    expect(shouldSkipLsp('x'.repeat(MONACO_LONG_LINE_CHARS + 1))).toBe(true)
    expect(shouldSkipLsp('a'.repeat(512 * 1024 + 1))).toBe(true)
  })

  it('disables advanced wrap for minified content and enables large-file mode', () => {
    const minified = 'var a=' + '1'.repeat(MONACO_LONG_LINE_CHARS)
    expect(monacoOptionsForContent(minified)).toEqual({
      largeFileOptimizations: true,
      wordWrap: 'off',
      wrappingStrategy: 'simple',
    })
  })

  it('keeps wrap for normal source files under the byte threshold', () => {
    const normal = monacoOptionsForContent('export const x = 1\n')
    expect(normal).toEqual({
      largeFileOptimizations: false,
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
    })
    expect(monacoOptionsForContent('# Title\n\nParagraph text\n')).toEqual(normal)
    expect(utf8ByteLength('café')).toBe(5)
  })

  it('tunes markdown for CJK IME with soft wrap instead of toggling wrap mid-composition', () => {
    const contentOptions = monacoOptionsForContent('# Title\n\nParagraph text\n')
    expect(monacoSurfaceOptionsForLanguage('markdown', contentOptions)).toEqual({
      wordWrap: 'on',
      wrappingStrategy: 'simple',
      accessibilitySupport: 'off',
    })
    expect(monacoSurfaceOptionsForLanguage('typescript', contentOptions)).toEqual({
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
    })
  })
})
