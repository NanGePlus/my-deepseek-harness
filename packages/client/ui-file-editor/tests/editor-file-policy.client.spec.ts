import { describe, expect, it } from 'vitest'
import {
  hasLongLine,
  monacoOptionsForContent,
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
    expect(monacoOptionsForContent('export const x = 1\n')).toEqual({
      largeFileOptimizations: false,
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
    })
    expect(utf8ByteLength('café')).toBe(5)
  })
})
