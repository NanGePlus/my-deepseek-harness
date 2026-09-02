import { describe, expect, it } from 'vitest'
import {
  normalizePublishDiagnostics,
  readPublishDiagnosticsVersion,
  shouldApplyPublishedDiagnostics,
  shouldUpdateDiagnosticsCache,
} from '../src/diagnostics.ts'

describe('normalizePublishDiagnostics', () => {
  it('normalizes severity and UTF-16 ranges', () => {
    const diagnostics = normalizePublishDiagnostics({
      uri: 'file:///tmp/a.ts',
      diagnostics: [
        {
          message: 'Expected semicolon',
          severity: 1,
          range: {
            start: { line: 0, character: 4 },
            end: { line: 0, character: 8 },
          },
        },
        {
          message: 'Unused variable',
          severity: 2,
          range: {
            start: { line: 2, character: 6 },
            end: { line: 2, character: 10 },
          },
        },
      ],
    })
    expect(diagnostics).toEqual([
      {
        message: 'Expected semicolon',
        severity: 'error',
        range: { start: { line: 0, character: 4 }, end: { line: 0, character: 8 } },
      },
      {
        message: 'Unused variable',
        severity: 'warning',
        range: { start: { line: 2, character: 6 }, end: { line: 2, character: 10 } },
      },
    ])
  })

  it('drops malformed entries', () => {
    expect(normalizePublishDiagnostics({ diagnostics: [{ message: '', severity: 1, range: {} }] })).toEqual([])
    expect(normalizePublishDiagnostics(null)).toEqual([])
  })
})

describe('publishDiagnostics version helpers', () => {
  it('reads and compares document versions', () => {
    expect(readPublishDiagnosticsVersion({ version: 3 })).toBe(3)
    expect(readPublishDiagnosticsVersion({ version: 1.5 })).toBeUndefined()
    expect(readPublishDiagnosticsVersion(null)).toBeUndefined()
    expect(shouldApplyPublishedDiagnostics(3, 3)).toBe(true)
    expect(shouldApplyPublishedDiagnostics(2, 3)).toBe(false)
    expect(shouldApplyPublishedDiagnostics(undefined, 3)).toBe(true)
    expect(shouldUpdateDiagnosticsCache(3, 3)).toBe(true)
    expect(shouldUpdateDiagnosticsCache(2, 3)).toBe(false)
    expect(shouldUpdateDiagnosticsCache(undefined, 3)).toBe(true)
  })
})
