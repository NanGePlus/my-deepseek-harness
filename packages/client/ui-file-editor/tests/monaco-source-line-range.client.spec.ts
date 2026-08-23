import { describe, expect, it, vi } from 'vitest'
import { applyMonacoSourceLineRange } from '../src/client/monaco-source-line-range.ts'

describe('applyMonacoSourceLineRange', () => {
  it('selects an inclusive one-based line range', () => {
    const setSelection = vi.fn()
    const revealLineInCenter = vi.fn()
    const editor = {
      getModel: () => ({
        getLineCount: () => 10,
        getLineMaxColumn: (line: number) => (line === 7 ? 12 : 5),
      }),
      setSelection,
      revealLineInCenter,
    }
    expect(applyMonacoSourceLineRange(editor as never, 1, 7)).toBe(true)
    expect(setSelection).toHaveBeenCalledWith({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 7,
      endColumn: 12,
    })
    expect(revealLineInCenter).toHaveBeenCalledWith(7)
  })

  it('returns false when the editor has no model', () => {
    const editor = { getModel: () => null, setSelection: vi.fn(), revealLineInCenter: vi.fn() }
    expect(applyMonacoSourceLineRange(editor as never, 1, 3)).toBe(false)
  })
})
