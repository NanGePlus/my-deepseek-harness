/** Editor-surface occupant of the details column file-editor tab. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  FileReadKind, FileReadResult, FileWriteResult, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { GitStatusListing, WorkspaceEntriesListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import { FileTreePane } from './FileTreePane.tsx'
import { EditorPane, type EditorPaneStatus } from './EditorPane.tsx'
import { languageForPath, openKindForPath } from './open-kind.ts'
import { createFileEditorStore, tabIsDirty } from './stores.ts'
import css from './EditorSurface.module.css'

/** Host file-tree and file I/O callbacks closed over `ctx.workspaces` in apply. */
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
  /**
   * Read one file inside the bound Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param kind - `text` for editable sources; `bytes` for image preview.
   * @param signal - aborts a superseded open.
   */
  readFile: (
    workspaceId: WorkspaceId,
    path: string,
    kind: FileReadKind,
    signal?: AbortSignal,
  ) => Promise<FileReadResult>
  /**
   * Explicitly save UTF-8 text to a path inside the bound Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - edit-buffer text to write.
   * @param signal - aborts a superseded save.
   */
  writeFile: (
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    signal?: AbortSignal,
  ) => Promise<FileWriteResult>
}

export type EditorSurfaceProps =
  PropsRuntime<'conversation.details.editor'>
  & PropsLocale<'fileEditor'>
  & PropsStore<ReturnType<typeof createFileEditorStore>>
  & FileEditorInjected

/** Document attribute that ui-theme sets for the Harness dark palette. */
const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/**
 * Editor-surface body: file tree on the left, tabbed editor pane on the right.
 * @param props - session-scoped runtime share, locale, tab store, and Host callbacks.
 */
export function EditorSurface({
  t, sessionId, useWorkspaces, useStore, actions,
  listWorkspaceEntries, gitStatus, readFile, writeFile,
}: EditorSurfaceProps) {
  const workspace = useWorkspaces(state =>
    state.items.find(item => item.sessionIds.includes(sessionId)),
  )
  const tabs = useStore(state => state.tabs)
  const activePath = useStore(state => state.activePath)
  const [status, setStatus] = useState<EditorPaneStatus>({ kind: 'idle' })
  const [dark, setDark] = useState(() => document.body.hasAttribute(DARK_ATTRIBUTE))
  const ioAbort = useRef<AbortController | null>(null)
  const retryRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const sync = (): void => { setDark(document.body.hasAttribute(DARK_ATTRIBUTE)) }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: [DARK_ATTRIBUTE] })
    return () => { observer.disconnect() }
  }, [])

  const openEntry = useCallback(async (entry: WorkspaceEntry) => {
    const existing = tabs.find(tab => tab.path === entry.path)
    if (existing !== undefined) {
      actions.focusTab(entry.path)
      setStatus({ kind: 'idle' })
      return
    }
    const kind = openKindForPath(entry.path)
    if (kind === 'non-openable') {
      actions.openTab({ kind: 'non-openable', path: entry.path, name: entry.name })
      setStatus({ kind: 'idle' })
      return
    }
    /* v8 ignore next -- FileTreePane only lists files when a Workspace is bound */
    if (workspace === undefined) return
    ioAbort.current?.abort()
    const ac = new AbortController()
    ioAbort.current = ac
    setStatus({ kind: 'loading', op: 'open' })
    retryRef.current = () => { void openEntry(entry) }
    try {
      if (kind === 'preview') {
        const result = await readFile(workspace.workspaceId, entry.path, 'bytes', ac.signal)
        if (ac.signal.aborted) return
        if (result.kind !== 'bytes') {
          setStatus({ kind: 'error', op: 'open', message: t('editor.error.open') })
          return
        }
        actions.openTab({
          kind: 'preview',
          path: entry.path,
          name: entry.name,
          mediaType: result.mediaType,
          data: result.data,
        })
      } else {
        const result = await readFile(workspace.workspaceId, entry.path, 'text', ac.signal)
        if (ac.signal.aborted) return
        if (result.kind !== 'text') {
          setStatus({ kind: 'error', op: 'open', message: t('editor.error.open') })
          return
        }
        actions.openTab({
          kind: 'text',
          path: entry.path,
          name: entry.name,
          language: languageForPath(entry.path),
          buffer: result.text,
          saved: result.text,
        })
      }
      setStatus({ kind: 'idle' })
    } catch (error: unknown) {
      if (ac.signal.aborted) return
      void error
      setStatus({ kind: 'error', op: 'open', message: t('editor.error.open') })
    }
  }, [tabs, actions, workspace, readFile, t])

  const saveActive = useCallback(async () => {
    const active = tabs.find(tab => tab.path === activePath)
    if (active === undefined || active.kind !== 'text' || workspace === undefined) return
    if (!tabIsDirty(active)) return
    ioAbort.current?.abort()
    const ac = new AbortController()
    ioAbort.current = ac
    setStatus({ kind: 'loading', op: 'save' })
    retryRef.current = () => { void saveActive() }
    try {
      await writeFile(workspace.workspaceId, active.path, active.buffer, ac.signal)
      if (ac.signal.aborted) return
      actions.markSaved(active.path)
      setStatus({ kind: 'idle' })
    } catch (error: unknown) {
      if (ac.signal.aborted) return
      void error
      setStatus({ kind: 'error', op: 'save', message: t('editor.error.save') })
    }
  }, [tabs, activePath, workspace, writeFile, actions, t])

  useEffect(() => () => { ioAbort.current?.abort() }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveActive()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [saveActive])

  return (
    <div className={css.editorRoot} data-surface="editor-surface">
      <FileTreePane
        workspace={workspace}
        listWorkspaceEntries={listWorkspaceEntries}
        gitStatus={gitStatus}
        t={t}
        onOpenFile={(entry) => { void openEntry(entry) }}
      />
      <div className={css.split} />
      <EditorPane
        tabs={tabs}
        activePath={activePath}
        status={status}
        dark={dark}
        t={t}
        onFocus={actions.focusTab}
        onClose={actions.closeTab}
        onBufferChange={actions.setBuffer}
        onSave={() => { void saveActive() }}
        onRetry={() => { retryRef.current?.() }}
      />
    </div>
  )
}
