/** Derive gutter line numbers from unified-diff hunk headers. */

import type { GitDiffLine } from '@deepseek-ai/dsh-client-runtime/client'

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/**
 * Parse the old/new start lines from one unified-diff hunk header.
 * @param header - the `@@ … @@` line from git diff.
 */
export function parseHunkHeader(header: string): { oldStart: number; newStart: number } | undefined {
  const match = HUNK_HEADER.exec(header)
  if (match === null) return undefined
  return { oldStart: Number(match[1]), newStart: Number(match[2]) }
}

/**
 * Assign the gutter line number shown beside each hunk line.
 * @param header - unified-diff hunk header.
 * @param lines - hunk body lines without the header row.
 */
export function lineNumbersForHunk(header: string, lines: readonly GitDiffLine[]): number[] {
  const range = parseHunkHeader(header)
  if (range === undefined) return lines.map(() => 0)
  let oldLine = range.oldStart
  let newLine = range.newStart
  return lines.map((line) => {
    switch (line.origin) {
      case 'del': {
        const number = oldLine
        oldLine++
        return number
      }
      case 'add': {
        const number = newLine
        newLine++
        return number
      }
      case 'context': {
        const number = oldLine
        oldLine++
        newLine++
        return number
      }
    }
  })
}
