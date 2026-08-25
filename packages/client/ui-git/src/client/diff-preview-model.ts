/** Flat diff-preview rows for the Git panel preview surface. */

import type { GitDiffHunk, GitDiffLine, GitDiffPreview } from '@deepseek-ai/dsh-client-runtime/client'
import { charDiffPair, type CharSpan } from './inline-char-diff.ts'
import { lineNumbersForHunk, parseHunkHeader } from './hunk-line-numbers.ts'

export type DiffPreviewRow =
  | { kind: 'header'; header: string; hunkHeader: string }
  | {
    kind: 'line'
    origin: GitDiffLine['origin']
    text: string
    lineNum: number
    charSpans?: CharSpan[]
    hunkHeader: string
    hunkLineIndex: number
  }
  | { kind: 'truncated'; omitted: number }

/** Maximum diff rows rendered in one preview before truncation. */
export const MAX_DIFF_PREVIEW_ROWS = 2000

/**
 * Flatten one Host diff preview into scrollable preview rows.
 * @param preview - Host gitDiffPreview value for the selected path.
 */
export function buildDiffPreviewRows(preview: GitDiffPreview): DiffPreviewRow[] {
  switch (preview.kind) {
    case 'text':
      return capRows(buildTrackedTextRows(preview.hunks, preview.fileText ?? ''))
    case 'untracked-text':
      return capRows(contentLines(preview.text).map((text, index) => ({
        kind: 'line' as const,
        origin: 'add' as const,
        text,
        lineNum: index + 1,
        hunkHeader: '',
        hunkLineIndex: index,
      })))
    case 'deleted-text':
      return capRows(contentLines(preview.text).map((text, index) => ({
        kind: 'line' as const,
        origin: 'del' as const,
        text,
        lineNum: index + 1,
        hunkHeader: '',
        hunkLineIndex: index,
      })))
    case 'binary':
    case 'deleted-binary':
      return []
    default:
      return assertNeverPreview(preview)
  }
}

function buildTrackedTextRows(hunks: readonly GitDiffHunk[], fileText: string): DiffPreviewRow[] {
  const rows: DiffPreviewRow[] = []
  const fileLines = contentLines(fileText)
  let lastNewLine = 0
  for (const hunk of hunks) {
    const range = parseHunkHeader(hunk.header)
    if (range !== undefined && range.newStart > lastNewLine + 1) {
      appendGapContextRows(rows, fileLines, lastNewLine + 1, range.newStart - 1)
    }
    rows.push({ kind: 'header', header: hunk.header, hunkHeader: hunk.header })
    appendHunkLineRows(rows, hunk)
    lastNewLine = Math.max(lastNewLine, endNewLine(hunk.header, hunk.lines))
  }
  if (fileLines.length > lastNewLine) {
    appendGapContextRows(rows, fileLines, lastNewLine + 1, fileLines.length)
  }
  return rows
}

function appendGapContextRows(
  rows: DiffPreviewRow[],
  fileLines: readonly string[],
  fromLine: number,
  toLine: number,
): void {
  for (let lineNum = fromLine; lineNum <= toLine; lineNum++) {
    const text = fileLines[lineNum - 1]
    if (text === undefined) continue
    rows.push({
      kind: 'line',
      origin: 'context',
      text,
      lineNum,
      hunkHeader: '',
      hunkLineIndex: -1,
    })
  }
}

function appendHunkLineRows(rows: DiffPreviewRow[], hunk: GitDiffHunk): void {
  const lineNums = lineNumbersForHunk(hunk.header, hunk.lines)
  for (let index = 0; index < hunk.lines.length; index++) {
    const line = hunk.lines[index]
    if (line === undefined) continue
    const next = hunk.lines[index + 1]
    if (line.origin === 'del' && next?.origin === 'add') {
      const spans = charDiffPair(line.text, next.text)
      rows.push({
        kind: 'line',
        origin: 'del',
        text: line.text,
        lineNum: lineNums[index] ?? 0,
        charSpans: spans.old,
        hunkHeader: hunk.header,
        hunkLineIndex: index,
      })
      rows.push({
        kind: 'line',
        origin: 'add',
        text: next.text,
        lineNum: lineNums[index + 1] ?? 0,
        charSpans: spans.new,
        hunkHeader: hunk.header,
        hunkLineIndex: index + 1,
      })
      index++
      continue
    }
    rows.push({
      kind: 'line',
      origin: line.origin,
      text: line.text,
      lineNum: lineNums[index] ?? 0,
      hunkHeader: hunk.header,
      hunkLineIndex: index,
    })
  }
}

function endNewLine(header: string, lines: readonly GitDiffLine[]): number {
  const range = parseHunkHeader(header)
  if (range === undefined) return 0
  let newLine = range.newStart
  for (const line of lines) {
    if (line.origin === 'add' || line.origin === 'context') newLine++
  }
  return Math.max(range.newStart - 1, newLine - 1)
}

function contentLines(text: string): string[] {
  if (text === '') return []
  const parts = text.split('\n')
  if (parts.at(-1) === '') parts.pop()
  return parts
}

function capRows(rows: DiffPreviewRow[]): DiffPreviewRow[] {
  if (rows.length <= MAX_DIFF_PREVIEW_ROWS) return rows
  return [
    ...rows.slice(0, MAX_DIFF_PREVIEW_ROWS),
    { kind: 'truncated', omitted: rows.length - MAX_DIFF_PREVIEW_ROWS },
  ]
}

function assertNeverPreview(value: never): never {
  throw new Error(`unreachable git diff preview kind: ${String(value)}`)
}
