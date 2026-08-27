/** Per-row shiki highlighting for the Git diff preview surface. */

import { useMemo, useSyncExternalStore } from 'react'
import * as UiPrimitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { HighlightSpan } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DiffPreviewRow } from './diff-preview-model.ts'
import { languageHintForPath } from './diff-preview-language.ts'

/** Avoid blocking the preview on very large tokenization work. */
const MAX_SYNTAX_HIGHLIGHT_LINES = 800

const noopSubscribe = (): (() => void) => () => {}
const noopSnapshot = (): number => 0

type HighlightLines = (
  code: string,
  lang: string | undefined,
) => HighlightSpan[][] | undefined

/**
 * Resolve shiki helpers from the platform module table; absent exports degrade to plain text.
 * @param primitives - platform `@deepseek-ai/dsh-client-ui-primitives` namespace.
 * @returns highlight helpers when the web seed pinned them.
 */
function resolveSyntaxHighlight(primitives: Record<string, unknown>): {
  highlightLines: HighlightLines | undefined
  subscribeGrammarLoaded: ((listener: () => void) => () => void) | undefined
  grammarLoadCount: (() => number) | undefined
} {
  const highlightLines = typeof primitives.highlightLines === 'function'
    ? primitives.highlightLines as HighlightLines
    : undefined
  const subscribeGrammarLoaded = typeof primitives.subscribeGrammarLoaded === 'function'
    ? primitives.subscribeGrammarLoaded as (listener: () => void) => () => void
    : undefined
  const grammarLoadCount = typeof primitives.grammarLoadCount === 'function'
    ? primitives.grammarLoadCount as () => number
    : undefined
  return { highlightLines, subscribeGrammarLoaded, grammarLoadCount }
}

const syntaxHighlight = resolveSyntaxHighlight(UiPrimitives as Record<string, unknown>)

/**
 * Highlight every content row in a diff preview, keyed by row index.
 * @param rows - flattened preview rows from {@link buildDiffPreviewRows}.
 * @param path - selected file path used for the grammar hint.
 * @returns a map from row index to that line's shiki runs.
 */
export function useDiffSyntaxHighlights(
  rows: readonly DiffPreviewRow[],
  path: string,
): ReadonlyMap<number, readonly HighlightSpan[]> {
  const lang = languageHintForPath(path)
  const loaded = useSyncExternalStore(
    syntaxHighlight.subscribeGrammarLoaded ?? noopSubscribe,
    syntaxHighlight.grammarLoadCount ?? noopSnapshot,
    syntaxHighlight.grammarLoadCount ?? noopSnapshot,
  )
  return useMemo(() => {
    const contentRows = rows.flatMap((row, index) => (row.kind === 'line' ? [index] : []))
    if (
      contentRows.length === 0
      || lang === undefined
      || syntaxHighlight.highlightLines === undefined
      || contentRows.length > MAX_SYNTAX_HIGHLIGHT_LINES
    ) {
      return new Map()
    }

    const raw = contentRows.map((index) => {
      const row = rows[index]
      return row?.kind === 'line' ? row.text : ''
    }).join('\n')
    let highlighted: HighlightSpan[][] | undefined
    try {
      highlighted = syntaxHighlight.highlightLines(raw, lang)
    } catch {
      return new Map()
    }
    if (highlighted === undefined) return new Map()

    const byRow = new Map<number, readonly HighlightSpan[]>()
    for (const [lineIndex, rowIndex] of contentRows.entries()) {
      const spans = highlighted[lineIndex]
      if (spans !== undefined) byRow.set(rowIndex, spans)
    }
    return byRow
  }, [rows, lang, loaded])
}
