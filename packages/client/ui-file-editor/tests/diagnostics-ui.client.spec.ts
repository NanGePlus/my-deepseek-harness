import { describe, expect, it } from 'vitest'
import { lspErrorCount } from '../src/client/diagnostics-ui.ts'

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
