/** Editor-surface occupant of the details column file-editor tab. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitStatusListing, WorkspaceEntriesListing, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { FileTreePane } from './FileTreePane.tsx'
import css from './EditorSurface.module.css'

/** Host file-tree callbacks closed over `ctx.workspaces` in apply. */
export interface FileEditorInjected {
  /**
   * List one directory level inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute directory to list.
   * @param signal - aborts a superseded scan.
   */
  listWorkspaceEntries: (
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ) => Promise<WorkspaceEntriesListing>
  /**
   * Read Git working-tree badge letters for a registered Workspace.
   * @param workspaceId - Workspace whose root is the git directory.
   * @param signal - aborts a superseded scan.
   */
  gitStatus: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<GitStatusListing>
}

export type EditorSurfaceProps =
  PropsRuntime<'conversation.details.editor'> & PropsLocale<'fileEditor'> & FileEditorInjected

/**
 * Editor-surface body: file tree on the left, unopened-file empty state on the right.
 * @param props - session-scoped runtime share, locale, and Host listing callbacks.
 */
export function EditorSurface({
  t, sessionId, useWorkspaces, listWorkspaceEntries, gitStatus,
}: EditorSurfaceProps) {
  const workspace = useWorkspaces(state =>
    state.items.find(item => item.sessionIds.includes(sessionId)),
  )
  return (
    <div className={css.editorRoot} data-surface="editor-surface">
      <FileTreePane
        workspace={workspace}
        listWorkspaceEntries={listWorkspaceEntries}
        gitStatus={gitStatus}
        t={t}
      />
      <div className={css.split} />
      <div className={css.editorPane}>
        <div className={css.emptyCard}>
          <div className={css.emptyTitle}>{t('editor.empty.title')}</div>
          <div className={css.emptyBody}>{t('editor.empty.body')}</div>
          <button type="button" className={css.emptyCta} disabled>{t('editor.empty.cta')}</button>
        </div>
      </div>
    </div>
  )
}
