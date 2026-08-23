import { describe, expect, it } from 'vitest'
import {
  buildFileContextReferenceInsert,
  decodeFileContextRef,
  encodeFileContextRef,
  extractFileContextLines,
  fileContextChipLabel,
  formatFileContextPrompt,
  monacoSelectionLineRange,
} from '../src/client/file-context-ref.ts'

describe('fileContextChipLabel', () => {
  it('formats single-line and multi-line labels', () => {
    expect(fileContextChipLabel({ path: '/w/CONTEXT.md', startLine: 19, endLine: 19 })).toBe('CONTEXT.md (19)')
    expect(fileContextChipLabel({ path: '/w/CONTEXT.md', startLine: 19, endLine: 21 })).toBe('CONTEXT.md (19-21)')
  })
})

describe('encode/decodeFileContextRef', () => {
  it('round-trips a workspace file line range', () => {
    const payload = {
      workspaceId: 'ws' as never,
      path: '/w/CONTEXT.md',
      startLine: 19,
      endLine: 21,
    }
    expect(decodeFileContextRef(encodeFileContextRef(payload))).toEqual(payload)
  })
})

describe('extractFileContextLines', () => {
  it('extracts one-based inclusive lines', () => {
    const text = 'a\nb\nc\nd'
    expect(extractFileContextLines(text, 2, 3)).toBe('b\nc')
  })
})

describe('formatFileContextPrompt', () => {
  it('wraps the excerpt in a fenced block with a file header', () => {
    expect(formatFileContextPrompt(
      { path: '/w/CONTEXT.md', startLine: 19, endLine: 21 },
      'line19\nline20',
    )).toMatchInlineSnapshot(`
      "From \`CONTEXT.md\` (lines 19-21):

      \`\`\`
      line19
      line20
      \`\`\`"
    `)
  })
})

describe('buildFileContextReferenceInsert', () => {
  it('builds a file-context reference chip insert payload', () => {
    const insert = buildFileContextReferenceInsert({
      workspaceId: 'ws' as never,
      absolutePath: '/w/CONTEXT.md',
      startLine: 19,
      endLine: 21,
    })
    expect(insert.source).toBe('file-context')
    expect(insert.label).toBe('CONTEXT.md (19-21)')
    expect(insert.draftToken).toBe('CONTEXT.md (19-21)')
    expect(decodeFileContextRef(insert.ref).path).toBe('/w/CONTEXT.md')
  })
})

describe('monacoSelectionLineRange', () => {
  it('normalizes reversed Monaco line numbers', () => {
    expect(monacoSelectionLineRange(21, 19)).toEqual({ startLine: 19, endLine: 21 })
  })
})
