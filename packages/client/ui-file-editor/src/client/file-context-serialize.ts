/** Prompt serialization for file line-range composer references. */

import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileReadKind, FileReadResult } from '@deepseek-ai/dsh-client-runtime/client'
import {
  decodeFileContextRef,
  extractFileContextLines,
  formatFileContextPrompt,
} from './file-context-ref.ts'

/** Host read callback used to expand a file line-range reference at submit time. */
export type FileContextReadFile = (
  workspaceId: WorkspaceId,
  path: string,
  kind: FileReadKind,
  signal?: AbortSignal,
) => Promise<FileReadResult>

/**
 * Expand one encoded file line-range reference into model-visible prompt text.
 * @param readFile - workspace read callback.
 * @param ref - encoded reference payload.
 * @param signal - submit attempt abort signal.
 */
export async function serializeFileContextReference(
  readFile: FileContextReadFile,
  ref: string,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('file-context serialization aborted')
  }
  const payload = decodeFileContextRef(ref)
  const result = await readFile(payload.workspaceId, payload.path, 'text', signal)
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('file-context serialization aborted')
  }
  if (result.kind !== 'text') throw new Error('file-context: expected a text file')
  const excerpt = extractFileContextLines(result.text, payload.startLine, payload.endLine)
  return formatFileContextPrompt({
    workspaceId: payload.workspaceId,
    path: payload.path,
    startLine: payload.startLine,
    endLine: payload.endLine,
  }, excerpt)
}
