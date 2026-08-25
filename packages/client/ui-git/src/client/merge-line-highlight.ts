/** Merge shiki syntax runs with inline character-diff spans for one preview line. */

import type { CSSProperties } from 'react'
import type { HighlightSpan } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CharSpan } from './inline-char-diff.ts'

/** One renderable segment after syntax and diff metadata are merged. */
export interface MergedLineSpan {
  text: string
  style?: CSSProperties | undefined
  charKind: CharSpan['kind']
}

interface Ranged<T> {
  start: number
  end: number
  meta: T
}

/**
 * Merge syntax and character-diff spans for one line of preview text.
 * @param text - the full line text both span arrays cover.
 * @param syntaxSpans - shiki runs for the line, when grammar is ready.
 * @param charSpans - inline diff spans; omitted means the whole line is unchanged.
 * @returns contiguous segments for rendering.
 */
export function mergeLineHighlight(
  text: string,
  syntaxSpans: readonly HighlightSpan[] | undefined,
  charSpans: CharSpan[] | undefined,
): readonly MergedLineSpan[] {
  const charRanges = buildCharRanges(text, charSpans)
  if (syntaxSpans === undefined) {
    return charRanges.map(range => ({ text: range.text, charKind: range.meta }))
  }
  if (charRanges.every(range => range.meta === 'same')) {
    return syntaxSpans.map(span => ({ text: span.text, style: span.style, charKind: 'same' as const }))
  }

  const syntaxRanges = buildSyntaxRanges(text, syntaxSpans)
  const splitPoints = collectSplitPoints(text.length, charRanges, syntaxRanges)
  const merged: MergedLineSpan[] = []
  for (let index = 0; index < splitPoints.length - 1; index += 1) {
    const start = splitPoints[index]
    const end = splitPoints[index + 1]
    if (start === undefined || end === undefined) continue
    if (start === end) continue
    const charKind = metaAt(start, toOffsetRanges(charRanges)) ?? 'same'
    const style = metaAt(start, syntaxRanges)
    const segment: MergedLineSpan = {
      text: text.slice(start, end),
      charKind,
      ...(style === undefined ? {} : { style }),
    }
    const previous = merged[merged.length - 1]
    if (
      previous !== undefined
      && previous.charKind === segment.charKind
      && stylesEqual(previous.style, segment.style)
    ) {
      previous.text += segment.text
    } else {
      merged.push(segment)
    }
  }
  return merged
}

interface CharRange {
  text: string
  meta: CharSpan['kind']
}

function toOffsetRanges(ranges: readonly CharRange[]): readonly Ranged<CharSpan['kind']>[] {
  const offsetRanges: Ranged<CharSpan['kind']>[] = []
  let offset = 0
  for (const range of ranges) {
    const start = offset
    offset += range.text.length
    offsetRanges.push({ start, end: offset, meta: range.meta })
  }
  return offsetRanges
}

function buildCharRanges(text: string, charSpans: CharSpan[] | undefined): readonly CharRange[] {
  if (charSpans === undefined || charSpans.length === 0) {
    return [{ text, meta: 'same' }]
  }
  return charSpans.map(span => ({ text: span.text, meta: span.kind }))
}

function buildSyntaxRanges(text: string, syntaxSpans: readonly HighlightSpan[]): readonly Ranged<CSSProperties>[] {
  const ranges: Ranged<CSSProperties>[] = []
  let offset = 0
  for (const span of syntaxSpans) {
    const start = offset
    offset += span.text.length
    ranges.push({ start, end: offset, meta: span.style })
  }
  if (offset !== text.length) {
    return [{ start: 0, end: text.length, meta: {} }]
  }
  return ranges
}

function collectSplitPoints(
  length: number,
  charRanges: readonly CharRange[],
  syntaxRanges: readonly Ranged<CSSProperties>[],
): number[] {
  const points = new Set<number>([0, length])
  let offset = 0
  for (const range of charRanges) {
    points.add(offset)
    offset += range.text.length
    points.add(offset)
  }
  for (const range of syntaxRanges) {
    points.add(range.start)
    points.add(range.end)
  }
  return [...points].sort((left, right) => left - right)
}

function metaAt<T>(offset: number, ranges: readonly Ranged<T>[]): T | undefined {
  for (const range of ranges) {
    if (offset >= range.start && offset < range.end) return range.meta
  }
  return undefined
}

function stylesEqual(left: CSSProperties | undefined, right: CSSProperties | undefined): boolean {
  if (left === right) return true
  if (left === undefined || right === undefined) return false
  return left.color === right.color
}
