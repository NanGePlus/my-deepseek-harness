/** Open one Host-absolute path in the workspace-scoped file-editor store. */

import type { FileReadKind, FileReadResult, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { fileNameOf, languageForPath, openKindForPath } from './open-kind.ts'
import { workspaceEditorState, type EditorTab, type FileEditorRootState } from './stores.ts'

/** Store read/write surface used by {@link openPathInEditor}. */
export interface OpenPathStore {
  getSnapshot: () => FileEditorRootState
  actions: {
    openTab: (workspaceId: WorkspaceId, tab: EditorTab) => void
    focusTab: (workspaceId: WorkspaceId, path: string) => void
  }
}

/** Host file read used when opening a path that is not already tabbed. */
export type OpenPathReadFile = (
  workspaceId: WorkspaceId,
  path: string,
  kind: FileReadKind,
  signal?: AbortSignal,
) => Promise<FileReadResult>

/**
 * Focus an existing tab or read and open one file in the editor store.
 * @param store - workspace-partitioned editor store instance.
 * @param readFile - Host read callback.
 * @param workspaceId - bound Workspace id.
 * @param absolutePath - Host-absolute file path.
 * @param signal - aborts a superseded open.
 * @returns `true` when a tab was focused or opened; `false` on read failure.
 */
export async function openPathInEditor(
  store: OpenPathStore,
  readFile: OpenPathReadFile,
  workspaceId: WorkspaceId,
  absolutePath: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const state = workspaceEditorState(store.getSnapshot(), workspaceId)
  if (state.tabs.some(tab => tab.path === absolutePath)) {
    store.actions.focusTab(workspaceId, absolutePath)
    return true
  }
  const kind = openKindForPath(absolutePath)
  const name = fileNameOf(absolutePath)
  if (kind === 'non-openable') {
    store.actions.openTab(workspaceId, { kind: 'non-openable', path: absolutePath, name })
    return true
  }
  try {
    if (kind === 'preview') {
      const result = await readFile(workspaceId, absolutePath, 'bytes', signal)
      if (signal?.aborted) return false
      if (result.kind !== 'bytes') return false
      store.actions.openTab(workspaceId, {
        kind: 'preview',
        path: absolutePath,
        name,
        mediaType: result.mediaType,
        data: result.data,
      })
    } else {
      const result = await readFile(workspaceId, absolutePath, 'text', signal)
      if (signal?.aborted) return false
      if (result.kind !== 'text') return false
      store.actions.openTab(workspaceId, {
        kind: 'text',
        path: absolutePath,
        name,
        language: languageForPath(absolutePath),
        buffer: result.text,
        saved: result.text,
        diskReloadTicket: 0,
      })
    }
    return true
  } catch (error: unknown) {
    void error
    return false
  }
}
