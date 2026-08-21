import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MONACO_HOVER_LANGUAGE_IDS } from '../src/client/open-kind.ts'
import { ensureLspHoverProviders, resetLspHoverProvidersForTest, setLspHoverHandler } from '../src/client/monaco-hover.ts'
import type { MonacoEditorModule } from '../src/client/monaco-load.ts'

describe('ensureLspHoverProviders', () => {
  beforeEach(() => {
    resetLspHoverProvidersForTest()
  })

  afterEach(() => {
    setLspHoverHandler(undefined)
  })
  it('registers one hover provider per editable Monaco language id', () => {
    const registerHoverProvider = vi.fn(() => ({ dispose: vi.fn() }))
    const monaco = {
      Range: class Range {
        startLineNumber = 0
        startColumn = 0
        endLineNumber = 0
        endColumn = 0
      },
      languages: { registerHoverProvider },
    } as unknown as MonacoEditorModule

    ensureLspHoverProviders(monaco)
    ensureLspHoverProviders(monaco)

    expect(registerHoverProvider).toHaveBeenCalledTimes(MONACO_HOVER_LANGUAGE_IDS.length)
    expect(registerHoverProvider.mock.calls.map(call => call[0])).toEqual(MONACO_HOVER_LANGUAGE_IDS)
  })

  it('delegates hover requests to the active handler', async () => {
    let captured: {
      provideHover: (
        model: unknown,
        position: { lineNumber: number; column: number },
        token: { onCancellationRequested: (listener: () => void) => { dispose: () => void } },
      ) => Promise<{ contents: Array<{ value: string }> } | null>
    } | undefined
    const registerHoverProvider = vi.fn((_language, provider) => {
      captured = provider
      return { dispose: vi.fn() }
    })
    const monaco = {
      Range: class {
        constructor(
          public startLineNumber: number,
          public startColumn: number,
          public endLineNumber: number,
          public endColumn: number,
        ) {}
      },
      languages: { registerHoverProvider },
    } as unknown as MonacoEditorModule

    ensureLspHoverProviders(monaco)
    setLspHoverHandler(async () => ({ contents: 'hello hover' }))
    const result = await captured!.provideHover({}, { lineNumber: 3, column: 5 }, {
      onCancellationRequested: () => ({ dispose: () => {} }),
    })
    expect(result).toEqual({ contents: [{ value: 'hello hover' }] })
    setLspHoverHandler(undefined)
  })
})
