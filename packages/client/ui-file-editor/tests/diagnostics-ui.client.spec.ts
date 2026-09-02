import { describe, expect, it } from 'vitest'
import { filterDiagnosticsForText, lspErrorCount, shouldApplyLspSyncDiagnostics } from '../src/client/diagnostics-ui.ts'

describe('shouldApplyLspSyncDiagnostics', () => {
  it('accepts only when the response version matches the latest sync', () => {
    expect(shouldApplyLspSyncDiagnostics(2, 2)).toBe(true)
    expect(shouldApplyLspSyncDiagnostics(1, 2)).toBe(false)
    expect(shouldApplyLspSyncDiagnostics(2, undefined)).toBe(false)
  })
})

describe('filterDiagnosticsForText', () => {
  const inRange = {
    severity: 'error' as const,
    message: 'ok',
    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
  }
  const pastEnd = {
    severity: 'error' as const,
    message: 'stale',
    range: { start: { line: 9, character: 0 }, end: { line: 9, character: 1 } },
  }

  it('drops diagnostics whose ranges fall outside the current buffer', () => {
    const text = 'a\nb\nc\n'
    expect(filterDiagnosticsForText(text, [inRange, pastEnd])).toEqual([inRange])
    const emptyLine = {
      severity: 'error' as const,
      message: 'ok',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    }
    expect(filterDiagnosticsForText('', [emptyLine])).toEqual([emptyLine])
  })
})

describe('lspErrorCount', () => {
  it('returns zero when diagnostics are missing or empty', () => {
    expect(lspErrorCount(undefined)).toBe(0)
    expect(lspErrorCount([])).toBe(0)
  })

  it('counts only error-severity diagnostics', () => {
    expect(lspErrorCount([
      { severity: 'error', message: 'x', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
      { severity: 'warning', message: 'y', range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } } },
      { severity: 'error', message: 'z', range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } } },
    ])).toBe(2)
  })
})
