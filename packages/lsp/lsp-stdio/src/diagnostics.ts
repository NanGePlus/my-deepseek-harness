/** Normalize LSP publishDiagnostics payloads for the editor seam. */

import type { LspEditorDiagnostic, LspEditorDiagnosticSeverity } from '@deepseek-ai/dsh-lsp-editor'
import type { LspPosition, LspRange } from '@deepseek-ai/dsh-lsp'

/**
 * Normalize one `textDocument/publishDiagnostics` params object.
 * @param params - raw notification params.
 * @returns normalized diagnostics; empty when malformed.
 */
export function normalizePublishDiagnostics(params: unknown): readonly LspEditorDiagnostic[] {
  if (params === null || typeof params !== 'object') return []
  const record = params as { diagnostics?: unknown }
  if (!Array.isArray(record.diagnostics)) return []
  return record.diagnostics.flatMap((entry) => {
    const normalized = normalizeDiagnostic(entry)
    return normalized === undefined ? [] : [normalized]
  })
}

function normalizeDiagnostic(entry: unknown): LspEditorDiagnostic | undefined {
  if (entry === null || typeof entry !== 'object') return undefined
  const record = entry as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message.trim() : ''
  if (message === '') return undefined
  const range = normalizeRange(record.range)
  if (range === undefined) return undefined
  return {
    message,
    severity: severityOf(record.severity),
    range,
  }
}

function severityOf(value: unknown): LspEditorDiagnosticSeverity {
  if (value === 1) return 'error'
  if (value === 2) return 'warning'
  if (value === 3) return 'info'
  return 'hint'
}

function normalizeRange(value: unknown): LspRange | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const start = normalizePosition(record.start)
  const end = normalizePosition(record.end)
  if (start === undefined || end === undefined) return undefined
  return { start, end }
}

function normalizePosition(value: unknown): LspPosition | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record.line !== 'number' || typeof record.character !== 'number') return undefined
  if (!Number.isInteger(record.line) || !Number.isInteger(record.character)) return undefined
  if (record.line < 0 || record.character < 0) return undefined
  return { line: record.line, character: record.character }
}
