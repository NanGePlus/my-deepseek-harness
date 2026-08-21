/** Host LSP hover wired into Monaco for every editable language id. */

import type { HostLspHover } from '@deepseek-ai/dsh-client-runtime/client'
import type { MonacoEditorModule } from './monaco-load.ts'
import { MONACO_HOVER_LANGUAGE_IDS } from './open-kind.ts'

export type LspHoverHandler = (
  line: number,
  character: number,
  signal?: AbortSignal,
) => Promise<HostLspHover | null>

const hoverHandlerRef: { current: LspHoverHandler | undefined } = { current: undefined }

/**
 * Bind the active editor tab's hover fetcher.
 * @param handler - hover callback for the focused Monaco surface, or undefined when none is mounted.
 */
export function setLspHoverHandler(handler: LspHoverHandler | undefined): void {
  hoverHandlerRef.current = handler
}

let hoverProvidersInstalled = false

/** Test-only reset for provider registration guard. */
export function resetLspHoverProvidersForTest(): void {
  hoverProvidersInstalled = false
}

/**
 * Register one LSP hover provider per Monaco language id.
 * @param monaco - loaded monaco-editor module.
 */
export function ensureLspHoverProviders(monaco: MonacoEditorModule): void {
  if (hoverProvidersInstalled) return
  hoverProvidersInstalled = true
  const register = monaco.languages?.registerHoverProvider
  if (register === undefined) return
  for (const languageId of MONACO_HOVER_LANGUAGE_IDS) {
    register(languageId, {
      provideHover: async (_model, position, token) => {
        const fetchHover = hoverHandlerRef.current
        if (fetchHover === undefined) return null
        const controller = new AbortController()
        const cancel = token.onCancellationRequested(() => { controller.abort() })
        try {
          const hover = await fetchHover(
            position.lineNumber - 1,
            position.column - 1,
            controller.signal,
          )
          if (hover === null || controller.signal.aborted) return null
          const RangeCtor = monaco.Range as new (
            startLineNumber: number,
            startColumn: number,
            endLineNumber: number,
            endColumn: number,
          ) => unknown
          return {
            contents: [{ value: hover.contents }],
            range: hover.range === undefined || RangeCtor === undefined ? undefined : new RangeCtor(
              hover.range.start.line + 1,
              hover.range.start.character + 1,
              hover.range.end.line + 1,
              hover.range.end.character + 1,
            ),
          }
        } catch {
          return null
        } finally {
          cancel.dispose()
        }
      },
    })
  }
}
