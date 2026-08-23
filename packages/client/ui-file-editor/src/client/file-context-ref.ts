/** File line-range references inserted from the Markdown source editor into the composer. */

import type { ReferenceInsert } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

/** Input trigger source id for file line-range chips. */
export const FILE_CONTEXT_SOURCE = 'file-context'

/** Payload encoded in {@link ReferenceInsert.ref}. */
export interface FileContextRefPayload {
  /** Workspace that owns the file path. */
  workspaceId: WorkspaceId
  /** Host-absolute file path. */
  path: string
  /** One-based inclusive start line. */
  startLine: number
  /** One-based inclusive end line. */
  endLine: number
}

/** Request to insert one file line-range reference into the session composer. */
export interface FileContextRefRequest {
  workspaceId: WorkspaceId
  absolutePath: string
  startLine: number
  endLine: number
}

/**
 * Normalize a Monaco selection to one-based inclusive line numbers.
 * @param startLineNumber - Monaco start line (1-based).
 * @param endLineNumber - Monaco end line (1-based).
 */
export function monacoSelectionLineRange(
  startLineNumber: number,
  endLineNumber: number,
): { startLine: number; endLine: number } {
  return {
    startLine: Math.min(startLineNumber, endLineNumber),
    endLine: Math.max(startLineNumber, endLineNumber),
  }
}

/**
 * Basename of a host-absolute or relative path.
 * @param path - file path.
 */
export function fileContextBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(slash + 1) : normalized
}

/**
 * Chip label for one file line-range reference.
 * @param payload - encoded reference payload.
 */
export function fileContextChipLabel(payload: Pick<FileContextRefPayload, 'path' | 'startLine' | 'endLine'>): string {
  const name = fileContextBasename(payload.path)
  if (payload.startLine === payload.endLine) return `${name} (${payload.startLine})`
  return `${name} (${payload.startLine}-${payload.endLine})`
}

/**
 * Encode a file line-range payload for {@link ReferenceInsert.ref}.
 * @param payload - workspace path and line range.
 */
export function encodeFileContextRef(payload: FileContextRefPayload): string {
  return JSON.stringify(payload)
}

/**
 * Decode a file line-range payload from {@link ReferenceInsert.ref}.
 * @param ref - encoded payload.
 */
export function decodeFileContextRef(ref: string): FileContextRefPayload {
  const parsed: unknown = JSON.parse(ref)
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('file-context: invalid reference payload')
  }
  const record = parsed as Record<string, unknown>
  if (
    typeof record.workspaceId !== 'string'
    || typeof record.path !== 'string'
    || typeof record.startLine !== 'number'
    || typeof record.endLine !== 'number'
  ) {
    throw new Error('file-context: invalid reference payload')
  }
  const rangeOk = Number.isInteger(record.startLine) && Number.isInteger(record.endLine)
    && record.startLine >= 1 && record.endLine >= record.startLine
  if (!rangeOk) {
    throw new Error('file-context: invalid line range')
  }
  return {
    workspaceId: record.workspaceId as WorkspaceId,
    path: record.path,
    startLine: record.startLine,
    endLine: record.endLine,
  }
}

/**
 * Extract one-based inclusive lines from buffer text.
 * @param text - full file buffer.
 * @param startLine - one-based start line.
 * @param endLine - one-based end line.
 */
export function extractFileContextLines(text: string, startLine: number, endLine: number): string {
  const lines = text.split('\n')
  if (lines.length === 0) return ''
  const start = Math.max(1, startLine)
  const end = Math.min(endLine, lines.length)
  if (start > end) return ''
  return lines.slice(start - 1, end).join('\n')
}

/**
 * Model-visible prompt block for one file line-range reference.
 * @param payload - decoded reference payload.
 * @param excerpt - selected line text.
 */
export function formatFileContextPrompt(
  payload: Pick<FileContextRefPayload, 'path' | 'startLine' | 'endLine'>,
  excerpt: string,
): string {
  const name = fileContextBasename(payload.path)
  const lineLabel = payload.startLine === payload.endLine
    ? `line ${payload.startLine}`
    : `lines ${payload.startLine}-${payload.endLine}`
  return `From \`${name}\` (${lineLabel}):\n\n\`\`\`\n${excerpt}\n\`\`\``
}

/**
 * Build a composer reference insertion for one file line range.
 * @param request - workspace file path and line range.
 */
export function buildFileContextReferenceInsert(request: FileContextRefRequest): ReferenceInsert {
  const payload: FileContextRefPayload = {
    workspaceId: request.workspaceId,
    path: request.absolutePath,
    startLine: request.startLine,
    endLine: request.endLine,
  }
  const label = fileContextChipLabel(payload)
  return {
    source: FILE_CONTEXT_SOURCE,
    ref: encodeFileContextRef(payload),
    label,
    clipboardText: label,
    draftToken: label,
  }
}
