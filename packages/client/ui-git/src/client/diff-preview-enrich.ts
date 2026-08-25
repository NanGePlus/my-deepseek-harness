/** Fill missing diff-preview file bodies before row flattening. */

import type {
  FileReadResult, GitDiffPreview, GitDiffSide, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Host RPC surface used to enrich text diff previews. */
export interface DiffPreviewHost {
  gitDiffPreview(
    workspaceId: WorkspaceId,
    path: string,
    side: GitDiffSide,
    signal?: AbortSignal,
  ): Promise<GitDiffPreview>
  readFile(
    workspaceId: WorkspaceId,
    path: string,
    kind: 'text',
    signal?: AbortSignal,
  ): Promise<FileReadResult>
}

/**
 * Return a tracked-text preview whose `fileText` is populated for gap fill.
 * @param host - workspace Host RPC surface.
 * @param workspaceId - bound workspace id.
 * @param path - host-absolute repository path.
 * @param side - unstaged vs staged list.
 * @param signal - caller lifetime.
 */
export async function gitDiffPreviewWithFullFile(
  host: DiffPreviewHost,
  workspaceId: WorkspaceId,
  path: string,
  side: GitDiffSide,
  signal?: AbortSignal,
): Promise<GitDiffPreview> {
  const preview = await host.gitDiffPreview(workspaceId, path, side, signal)
  if (preview.kind !== 'text') return preview
  const fileText = preview.fileText ?? ''
  if (fileText.length > 0) return preview
  try {
    const read = await host.readFile(workspaceId, path, 'text', signal)
    if (read.kind === 'text' && read.text.length > 0) {
      return { ...preview, fileText: read.text }
    }
  } catch {
    // Host preview stays hunk-only when the file cannot be read.
  }
  return preview
}
