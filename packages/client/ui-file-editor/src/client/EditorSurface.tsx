/** Editor-surface occupant of the details column file-editor tab. */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  FileReadKind, FileReadResult, FileWriteResult, PathMutationResult, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { GitStatusListing, WorkspaceEntriesListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import { FileTreePane } from './FileTreePane.tsx'
import { EditorPane, type EditorPaneStatus } from './EditorPane.tsx'
import { languageForPath, openKindForPath } from './open-kind.ts'
import { createFileEditorStore, tabIsDirty } from './stores.ts'
import { createDirtyGuard, type DirtyGuard, type SessionEditorBridge } from './dirty-guard.ts'
import css from './EditorSurface.module.css'
import dialogCss from './FileTreeDialogs.module.css'

/** Pending external-change dialog for one text tab. */
interface ExternalChangeDialog {
  /** Host-absolute path. */
  path: string
  /** File name shown in the dialog body. */
  name: string
}

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
  /**
   * Delete one file or directory inside the bound Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute path to delete.
   * @param signal - aborts a superseded mutation.
   */
  deletePath: (
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ) => Promise<PathMutationResult>
  /**
   * Rename one path within its parent directory.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute source path.
   * @param newName - single-segment new base name.
   * @param signal - aborts a superseded mutation.
   */
  renamePath: (
    workspaceId: WorkspaceId,
    path: string,
    newName: string,
    signal?: AbortSignal,
  ) => Promise<PathMutationResult>
  /**
   * Create one child directory under an existing parent.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute parent directory.
   * @param name - single-segment directory name.
   * @param signal - aborts a superseded mutation.
   */
  createWorkspaceDirectory: (
    workspaceId: WorkspaceId,
    path: string,
    name: string,
    signal?: AbortSignal,
  ) => Promise<PathMutationResult>
  /**
   * Subscribe to external disk changes for one opened path until `signal` aborts.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path to watch.
   * @param onChanged - invoked once per Host path-changed frame.
   * @param signal - aborts the stream and closes the subscription.
   */
  watchPath: (
    workspaceId: WorkspaceId,
    path: string,
    onChanged: () => void,
    signal?: AbortSignal,
  ) => void
}

/** Dirty guard face injected from apply (session open interception + dialogs). */
export interface FileEditorDirtyGuardInjected {
  /** Shared dirty-tab / session-switch guard coordinator. */
  dirtyGuard: DirtyGuard
}

export type EditorSurfaceProps =
  PropsRuntime<'conversation.details.editor'>
  & PropsLocale<'fileEditor'>
  & PropsStore<ReturnType<typeof createFileEditorStore>>
  & FileEditorInjected
  & FileEditorDirtyGuardInjected

/** Shared guard instance for apply wiring and component tests. */
export const editorDirtyGuard = createDirtyGuard()

/** Document attribute that ui-theme sets for the Harness dark palette. */
const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/**
 * Editor-surface body: file tree on the left, tabbed editor pane on the right.
 * @param props - session-scoped runtime share, locale, tab store, and Host callbacks.
 */
export function EditorSurface({
  t, sessionId, useWorkspaces, useStore, actions, dirtyGuard,
  listWorkspaceEntries, gitStatus, readFile, writeFile,
  deletePath, renamePath, createWorkspaceDirectory, watchPath,
}: EditorSurfaceProps) {
  const workspace = useWorkspaces(state =>
    state.items.find(item => item.sessionIds.includes(sessionId)),
  )
  const tabs = useStore(state => state.tabs)
  const activePath = useStore(state => state.activePath)
  const [status, setStatus] = useState<EditorPaneStatus>({ kind: 'idle' })
  const [dark, setDark] = useState(() => document.body.hasAttribute(DARK_ATTRIBUTE))
  const [newFileTrigger, setNewFileTrigger] = useState(0)
  const [externalChange, setExternalChange] = useState<ExternalChangeDialog | null>(null)
  const ioAbort = useRef<AbortController | null>(null)
  const retryRef = useRef<(() => void) | null>(null)
  const watchAbort = useRef<Map<string, AbortController>>(new Map())
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const guardMode = useSyncExternalStore(dirtyGuard.subscribe, dirtyGuard.getSnapshot)
  const activeGuard =
    guardMode.mode.kind !== 'idle' && guardMode.mode.sessionId === sessionId
      ? guardMode.mode
      : null

  const saveTab = useCallback(async (path: string): Promise<boolean> => {
    const tab = tabsRef.current.find(item => item.path === path)
    /* v8 ignore next -- guard only runs for open text tabs in a bound Workspace */
    if (tab?.kind !== 'text' || workspace === undefined) return false
    try {
      await writeFile(workspace.workspaceId, path, tab.buffer)
      actions.markSaved(path)
      return true
    } catch (error: unknown) {
      void error
      return false
    }
  }, [workspace, writeFile, actions])

  useEffect(() => {
    const bridge: SessionEditorBridge = {
      dirtyTabs: () => tabsRef.current
        .filter(tabIsDirty)
        .map(tab => ({ path: tab.path, name: tab.name })),
      saveTab,
      discardTab: (path) => { actions.closeTab(path) },
      closeAllTabs: () => { actions.closeAllTabs() },
    }
    return dirtyGuard.registerBridge(sessionId, bridge)
  }, [sessionId, dirtyGuard, actions, saveTab])

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

  const checkExternalChange = useCallback(async (path: string): Promise<void> => {
    if (workspace === undefined) return
    const tab = tabsRef.current.find(item => item.path === path)
    if (tab?.kind !== 'text') return
    try {
      const result = await readFile(workspace.workspaceId, path, 'text')
      if (result.kind !== 'text') return
      if (result.text === tab.buffer) return
      setExternalChange({ path, name: tab.name })
    } catch (error: unknown) {
      void error
    }
  }, [workspace, readFile])

  useEffect(() => {
    if (workspace === undefined) return
    const textPaths = new Set(
      tabs.filter(tab => tab.kind === 'text').map(tab => tab.path),
    )
    for (const [path, controller] of watchAbort.current) {
      if (!textPaths.has(path)) {
        controller.abort()
        watchAbort.current.delete(path)
      }
    }
    for (const path of textPaths) {
      if (watchAbort.current.has(path)) continue
      const controller = new AbortController()
      watchAbort.current.set(path, controller)
      watchPath(
        workspace.workspaceId,
        path,
        () => { void checkExternalChange(path) },
        controller.signal,
      )
    }
  }, [tabs, workspace, watchPath, checkExternalChange])

  useEffect(() => () => {
    for (const controller of watchAbort.current.values()) controller.abort()
    watchAbort.current.clear()
  }, [])

  const reloadExternalChange = useCallback(async (): Promise<void> => {
    if (externalChange === null || workspace === undefined) return
    try {
      const result = await readFile(workspace.workspaceId, externalChange.path, 'text')
      if (result.kind === 'text') actions.reloadTextTab(externalChange.path, result.text)
      setExternalChange(null)
    } catch (error: unknown) {
      void error
    }
  }, [externalChange, workspace, readFile, actions])

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

  const handlePathDeleted = useCallback((path: string) => {
    if (tabs.some(tab => tab.path === path)) actions.closeTab(path)
  }, [tabs, actions])

  const handlePathRenamed = useCallback((oldPath: string, newPath: string, newName: string) => {
    actions.renameTabPath(oldPath, newPath, newName)
  }, [actions])

  const handleCloseTab = useCallback((path: string) => {
    if (dirtyGuard.requestCloseTab(sessionId, path)) return
    actions.closeTab(path)
  }, [dirtyGuard, sessionId, actions])

  return (
    <div className={css.editorRoot} data-surface="editor-surface">
      <FileTreePane
        workspace={workspace}
        listWorkspaceEntries={listWorkspaceEntries}
        gitStatus={gitStatus}
        deletePath={deletePath}
        renamePath={renamePath}
        createWorkspaceDirectory={createWorkspaceDirectory}
        writeFile={writeFile}
        t={t}
        newFileTrigger={newFileTrigger}
        onPathDeleted={handlePathDeleted}
        onPathRenamed={handlePathRenamed}
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
        onClose={handleCloseTab}
        onBufferChange={actions.setBuffer}
        onSave={() => { void saveActive() }}
        onRetry={() => { retryRef.current?.() }}
        onNewFile={() => { setNewFileTrigger(current => current + 1) }}
      />
      <Modal
        open={externalChange !== null}
        onClose={() => { setExternalChange(null) }}
        closeLabel={t('editor.dialog.close')}
        title={t('editor.dialog.externalChange.title')}
        className={dialogCss.dialogSurface ?? ''}
        {...externalChange === null
          ? {}
          : { description: t('editor.dialog.externalChange.desc', { name: externalChange.name }) }}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setExternalChange(null) }}>
              {t('editor.dialog.externalChange.keepLocal')}
            </Button>
            <Button variant="primary" onClick={() => { void reloadExternalChange() }}>
              {t('editor.dialog.externalChange.reload')}
            </Button>
          </>
        )}
      />
      <Modal
        open={activeGuard !== null}
        onClose={() => { dirtyGuard.cancel() }}
        closeLabel={t('editor.dialog.close')}
        title={t('editor.dialog.dirtyGuard.title')}
        className={dialogCss.dialogSurface ?? ''}
        {...activeGuard === null || activeGuard.queue[0] === undefined
          ? {}
          : { description: t('editor.dialog.dirtyGuard.desc', { name: activeGuard.queue[0].name }) }}
        footer={(
          <>
            {activeGuard?.saveError !== undefined && (
              <div className={dialogCss.fieldError} role="alert">
                {t('editor.dialog.dirtyGuard.saveError')}
              </div>
            )}
            <Button variant="outline" onClick={() => { dirtyGuard.cancel() }}>
              {t('editor.dialog.dirtyGuard.cancel')}
            </Button>
            <Button variant="outline" onClick={() => { dirtyGuard.discardCurrent() }}>
              {t('editor.dialog.dirtyGuard.discard')}
            </Button>
            <Button variant="primary" onClick={() => { void dirtyGuard.saveCurrent() }}>
              {t('editor.dialog.dirtyGuard.save')}
            </Button>
          </>
        )}
      />
    </div>
  )
}
