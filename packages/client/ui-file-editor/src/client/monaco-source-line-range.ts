/** Apply one Monaco source line-range selection. */

import type { MonacoStandaloneEditor } from './monaco-load.ts'

/** Apply one inclusive one-based line range in a Monaco editor and scroll it into view.
 * @returns whether a model was available and the selection was applied.
 */
export function applyMonacoSourceLineRange(
  editor: MonacoStandaloneEditor,
  startLine: number,
  endLine: number,
): boolean {
  const model = editor.getModel()
  if (model === null) return false
  const start = Math.min(startLine, endLine)
  const end = Math.max(startLine, endLine)
  const lineCount = model.getLineCount()
  const safeStart = Math.max(1, Math.min(start, lineCount))
  const safeEnd = Math.max(safeStart, Math.min(end, lineCount))
  editor.setSelection({
    startLineNumber: safeStart,
    startColumn: 1,
    endLineNumber: safeEnd,
    endColumn: model.getLineMaxColumn(safeEnd),
  })
  editor.revealLineInCenter(safeEnd)
  return true
}
