/** Editor-surface occupant of the details column file-editor tab. */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  FileReadKind, FileReadResult, FileWriteResult, PathMutationResult, WorkspaceId,
  HostLspDiagnostic,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { GitStatusListing, WorkspaceEntriesListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import { FileTreePane } from './FileTreePane.tsx'
import { EditorPane, type EditorPaneStatus } from './EditorPane.tsx'
import { TreeSplitHandle } from './TreeSplitHandle.tsx'
import { clampTreeWidth, TREE_WIDTH_DEFAULT } from './tree-layout.ts'
import { languageForPath, openKindForPath } from './open-kind.ts'
import { createFileEditorStore, tabIsDirty, workspaceEditorState, type EditorTab } from './stores.ts'
import { createDirtyGuard, type DirtyGuard, type WorkspaceEditorBridge } from './dirty-guard.ts'
import { shouldSkipLsp, yieldToMain } from './editor-file-policy.ts'
import { FILE_READ_TIMEOUT_MS, withHostIoTimeout } from './host-io-timeout.ts'
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
  /**
   * Sync one editor buffer with the host language server.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - current edit-buffer text.
   * @param version - monotonic document version (>= 1).
   * @param signal - aborts a superseded sync.
   */
  lspSyncDocument: (
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    version: number,
    signal?: AbortSignal,
  ) => Promise<{ diagnostics: readonly HostLspDiagnostic[] }>
  /**
   * Close one editor document in the host language server.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param signal - aborts a superseded close.
   */
  lspCloseDocument: (
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ) => Promise<{ closed: true }>
  /**
   * Query hover for one open editor document.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param line - zero-based UTF-16 line.
   * @param character - zero-based UTF-16 character.
   * @param signal - aborts a superseded hover request.
   */
  lspHoverDocument: (
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    version: number,
    line: number,
    character: number,
    signal?: AbortSignal,
  ) => Promise<{ hover: { contents: string; range?: HostLspDiagnostic['range'] } | null }>
}

/** Dirty guard face injected from apply (close-tab dialogs). */
export interface FileEditorDirtyGuardInjected {
  /** Shared dirty-tab guard coordinator. */
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
 * @param props - root runtime share, locale, Workspace-partitioned tab store, and Host callbacks.
 */
export function EditorSurface({
  t, useSessions, useWorkspaces, useStore, actions, dirtyGuard,
  listWorkspaceEntries, gitStatus, readFile, writeFile,
  deletePath, renamePath, createWorkspaceDirectory, watchPath,
  lspSyncDocument, lspCloseDocument, lspHoverDocument,
}: EditorSurfaceProps) {
  const currentSessionId = useSessions(state => state.current)
  const workspace = useWorkspaces(state =>
    state.items.find(item => currentSessionId !== undefined && item.sessionIds.includes(currentSessionId)),
  )
  const workspaceId = workspace?.workspaceId
  const tabs = useStore(state => workspaceId === undefined
    ? []
    : workspaceEditorState(state, workspaceId).tabs)
  const activePath = useStore(state => workspaceId === undefined
    ? undefined
    : workspaceEditorState(state, workspaceId).activePath)
  const editorActions = useMemo(() => {
    if (workspaceId === undefined) return undefined
    const wid = workspaceId
    return {
      openTab: (tab: EditorTab) => { actions.openTab(wid, tab) },
      focusTab: (path: string) => { actions.focusTab(wid, path) },
      closeTab: (path: string) => { actions.closeTab(wid, path) },
      setBuffer: (path: string, buffer: string) => { actions.setBuffer(wid, path, buffer) },
      markSaved: (path: string) => { actions.markSaved(wid, path) },
      reloadTextTab: (path: string, text: string) => { actions.reloadTextTab(wid, path, text) },
      renameTabPath: (oldPath: string, newPath: string, newName: string) => {
        actions.renameTabPath(wid, oldPath, newPath, newName)
      },
      closeAllTabs: () => { actions.closeAllTabs(wid) },
    }
  }, [workspaceId, actions])
  const [status, setStatus] = useState<EditorPaneStatus>({ kind: 'idle' })
  const [dark, setDark] = useState(() => document.body.hasAttribute(DARK_ATTRIBUTE))
  const [newFileTrigger, _setNewFileTrigger] = useState(0)
  const [gitRefreshTrigger, setGitRefreshTrigger] = useState(0)
  const [treeVisible, setTreeVisible] = useState(true)
  const [treeWidthPx, setTreeWidthPx] = useState<number | null>(null)
  const [treeDragging, setTreeDragging] = useState(false)
  const [externalChange, setExternalChange] = useState<ExternalChangeDialog | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const treeDragBase = useRef(0)
  const ioAbort = useRef<AbortController | null>(null)
  const openGeneration = useRef(0)
  const retryRef = useRef<(() => void) | null>(null)
  const watchAbort = useRef<Map<string, AbortController>>(new Map())
  const unwatchedPaths = useRef<Set<string>>(new Set())
  const lspVersions = useRef<Map<string, number>>(new Map())
  const lspSyncAbort = useRef<Map<string, AbortController>>(new Map())
  const lspDebounce = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lspSyncPromises = useRef<Map<string, Promise<void>>>(new Map())
  const [lspDiagnostics, setLspDiagnostics] = useState<ReadonlyMap<string, readonly HostLspDiagnostic[]>>(new Map())
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  useEffect(() => {
    setLspDiagnostics(new Map())
    openGeneration.current += 1
    ioAbort.current?.abort()
    ioAbort.current = null
    setStatus({ kind: 'idle' })
  }, [workspaceId])

  const guardMode = useSyncExternalStore(dirtyGuard.subscribe, dirtyGuard.getSnapshot)
  const activeGuard =
    guardMode.mode.kind !== 'idle' && workspaceId !== undefined && guardMode.mode.workspaceId === workspaceId
      ? guardMode.mode
      : null

  const bumpGitRefresh = useCallback(() => {
    setGitRefreshTrigger(current => current + 1)
  }, [])

  const saveTab = useCallback(async (path: string): Promise<boolean> => {
    const tab = tabsRef.current.find(item => item.path === path)
    /* v8 ignore next -- guard only runs for open text tabs in a bound Workspace */
    if (tab?.kind !== 'text' || workspace === undefined) return false
    try {
      await writeFile(workspace.workspaceId, path, tab.buffer)
      editorActions?.markSaved(path)
      bumpGitRefresh()
      return true
    } catch (error: unknown) {
      void error
      return false
    }
  }, [workspace, writeFile, editorActions, bumpGitRefresh])

  useEffect(() => {
    if (workspaceId === undefined) return
    const bridge: WorkspaceEditorBridge = {
      dirtyTabs: () => tabsRef.current
        .filter(tabIsDirty)
        .map(tab => ({ path: tab.path, name: tab.name })),
      saveTab,
      discardTab: (path) => { editorActions?.closeTab(path) },
    }
    return dirtyGuard.registerBridge(workspaceId, bridge)
  }, [workspaceId, dirtyGuard, editorActions, saveTab])

  useEffect(() => {
    const sync = (): void => { setDark(document.body.hasAttribute(DARK_ATTRIBUTE)) }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: [DARK_ATTRIBUTE] })
    return () => { observer.disconnect() }
  }, [])

  const syncLsp = useCallback((path: string, text: string): Promise<void> => {
    if (workspace === undefined) return Promise.resolve()
    if (shouldSkipLsp(text)) return Promise.resolve()
    const tab = tabsRef.current.find(item => item.path === path)
    if (tab?.kind !== 'text') return Promise.resolve()
    const version = (lspVersions.current.get(path) ?? 0) + 1
    lspVersions.current.set(path, version)
    lspSyncAbort.current.get(path)?.abort()
    const controller = new AbortController()
    lspSyncAbort.current.set(path, controller)
    const promise = lspSyncDocument(workspace.workspaceId, path, text, version, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setLspDiagnostics((prev) => {
        const next = new Map(prev)
        next.set(path, result.diagnostics)
        return next
      })
    }).catch(() => {}).finally(() => {
      if (lspSyncPromises.current.get(path) === promise) {
        lspSyncPromises.current.delete(path)
      }
    })
    lspSyncPromises.current.set(path, promise)
    return promise
  }, [workspace, lspSyncDocument])

  const scheduleLspSync = useCallback((path: string, text: string) => {
    if (shouldSkipLsp(text)) return
    const pending = lspDebounce.current.get(path)
    if (pending !== undefined) clearTimeout(pending)
    lspDebounce.current.set(path, setTimeout(() => {
      lspDebounce.current.delete(path)
      syncLsp(path, text)
    }, 400))
  }, [syncLsp])

  const closeLsp = useCallback((path: string) => {
    if (workspace === undefined) return
    lspSyncAbort.current.get(path)?.abort()
    lspSyncAbort.current.delete(path)
    const pending = lspDebounce.current.get(path)
    if (pending !== undefined) clearTimeout(pending)
    lspDebounce.current.delete(path)
    lspVersions.current.delete(path)
    void lspCloseDocument(workspace.workspaceId, path).catch(() => {})
  }, [workspace, lspCloseDocument])

  const fetchLspHover = useCallback(async (
    path: string,
    line: number,
    character: number,
    signal?: AbortSignal,
  ) => {
    if (workspace === undefined) return null
    const tab = tabsRef.current.find(item => item.path === path)
    if (tab?.kind !== 'text') return null
    if (shouldSkipLsp(tab.buffer)) return null
    let pending = lspSyncPromises.current.get(path)
    if (pending === undefined && (lspVersions.current.get(path) ?? 0) === 0) {
      pending = syncLsp(path, tab.buffer)
    }
    if (pending !== undefined) {
      try {
        await pending
      } catch {
        void 0
      }
      if (signal?.aborted) return null
    }
    const version = lspVersions.current.get(path) ?? 1
    try {
      const result = await lspHoverDocument(
        workspace.workspaceId,
        path,
        tab.buffer,
        version,
        line,
        character,
        signal,
      )
      return result.hover
    } catch {
      return null
    }
  }, [workspace, lspHoverDocument, syncLsp])

  const focusEditorTab = useCallback((path: string): void => {
    openGeneration.current += 1
    ioAbort.current?.abort()
    ioAbort.current = null
    setStatus({ kind: 'idle' })
    editorActions?.focusTab(path)
  }, [editorActions])

  const dismissOpenFeedback = useCallback((): void => {
    openGeneration.current += 1
    ioAbort.current?.abort()
    ioAbort.current = null
    setStatus(current => (
      current.kind === 'loading' && current.op === 'open'
        ? { kind: 'idle' }
        : current.kind === 'error' && current.op === 'open'
          ? { kind: 'idle' }
          : current
    ))
  }, [])

  const readFileWithTimeout = useCallback(async (
    workspaceId: WorkspaceId,
    path: string,
    kind: FileReadKind,
    controller: AbortController,
  ): Promise<FileReadResult> => withHostIoTimeout(
    readFile(workspaceId, path, kind, controller.signal),
    controller,
    FILE_READ_TIMEOUT_MS,
    'file read timed out',
  ), [readFile])

  const openEntry = useCallback(async (entry: WorkspaceEntry) => {
    if (editorActions === undefined) return
    const existing = tabsRef.current.find(tab => tab.path === entry.path)
    if (existing !== undefined) {
      focusEditorTab(entry.path)
      return
    }
    const kind = openKindForPath(entry.path)
    if (kind === 'non-openable') {
      openGeneration.current += 1
      ioAbort.current?.abort()
      ioAbort.current = null
      editorActions.openTab({ kind: 'non-openable', path: entry.path, name: entry.name })
      setStatus({ kind: 'idle' })
      return
    }
    /* v8 ignore next -- FileTreePane only lists files when a Workspace is bound */
    if (workspace === undefined) return
    openGeneration.current += 1
    const generation = openGeneration.current
    ioAbort.current?.abort()
    const ac = new AbortController()
    ioAbort.current = ac
    setStatus({ kind: 'loading', op: 'open' })
    retryRef.current = () => { void openEntry(entry) }
    const applyOpenStatus = (next: EditorPaneStatus): void => {
      if (openGeneration.current !== generation) return
      setStatus(next)
    }
    try {
      if (kind === 'preview') {
        const result = await readFileWithTimeout(workspace.workspaceId, entry.path, 'bytes', ac)
        if (ac.signal.aborted || openGeneration.current !== generation) return
        if (result.kind !== 'bytes') {
          applyOpenStatus({ kind: 'error', op: 'open', message: t('editor.error.open') })
          return
        }
        editorActions.openTab({
          kind: 'preview',
          path: entry.path,
          name: entry.name,
          mediaType: result.mediaType,
          data: result.data,
        })
      } else {
        const result = await readFileWithTimeout(workspace.workspaceId, entry.path, 'text', ac)
        if (ac.signal.aborted || openGeneration.current !== generation) return
        if (result.kind !== 'text') {
          applyOpenStatus({ kind: 'error', op: 'open', message: t('editor.error.open') })
          return
        }
        await yieldToMain()
        if (ac.signal.aborted || openGeneration.current !== generation) return
        editorActions.openTab({
          kind: 'text',
          path: entry.path,
          name: entry.name,
          language: languageForPath(entry.path),
          buffer: result.text,
          saved: result.text,
        })
        if (!shouldSkipLsp(result.text)) syncLsp(entry.path, result.text)
      }
      applyOpenStatus({ kind: 'idle' })
    } catch (error: unknown) {
      if (ac.signal.aborted || openGeneration.current !== generation) return
      if (error instanceof DirectoryBrowseError && error.rpcError.code === 'file-too-large') {
        applyOpenStatus({ kind: 'error', op: 'open', message: t('editor.error.openTooLarge') })
        return
      }
      void error
      applyOpenStatus({ kind: 'error', op: 'open', message: t('editor.error.open') })
    }
  }, [editorActions, workspace, readFileWithTimeout, t, syncLsp, focusEditorTab])

  const checkExternalChange = useCallback(async (path: string): Promise<void> => {
    if (workspace === undefined) return
    const tab = tabsRef.current.find(item => item.path === path)
    if (tab?.kind !== 'text') return
    if (shouldSkipLsp(tab.buffer)) return
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
    const active = tabs.find(tab => tab.path === activePath)
    const watchedPath = active?.kind === 'text' ? active.path : undefined
    for (const [path, controller] of watchAbort.current) {
      if (path !== watchedPath) {
        controller.abort()
        watchAbort.current.delete(path)
        unwatchedPaths.current.add(path)
      }
    }
    if (watchedPath === undefined || watchAbort.current.has(watchedPath)) return
    if (unwatchedPaths.current.has(watchedPath)) {
      unwatchedPaths.current.delete(watchedPath)
      void checkExternalChange(watchedPath)
    }
    const controller = new AbortController()
    watchAbort.current.set(watchedPath, controller)
    watchPath(
      workspace.workspaceId,
      watchedPath,
      () => { void checkExternalChange(watchedPath) },
      controller.signal,
    )
  }, [tabs, activePath, workspace, watchPath, checkExternalChange])

  useEffect(() => () => {
    for (const controller of watchAbort.current.values()) controller.abort()
    watchAbort.current.clear()
    unwatchedPaths.current.clear()
    for (const timer of lspDebounce.current.values()) clearTimeout(timer)
    lspDebounce.current.clear()
    for (const controller of lspSyncAbort.current.values()) controller.abort()
    lspSyncAbort.current.clear()
  }, [])

  const reloadExternalChange = useCallback(async (): Promise<void> => {
    if (externalChange === null || workspace === undefined) return
    try {
      const result = await readFile(workspace.workspaceId, externalChange.path, 'text')
      if (result.kind === 'text') editorActions?.reloadTextTab(externalChange.path, result.text)
      setExternalChange(null)
    } catch (error: unknown) {
      void error
    }
  }, [externalChange, workspace, readFile, editorActions])

  const saveActive = useCallback(async () => {
    const active = tabs.find(tab => tab.path === activePath)
    if (active === undefined || active.kind !== 'text' || workspace === undefined) return
    if (!tabIsDirty(active)) return
    ioAbort.current?.abort()
    const ac = new AbortController()
    ioAbort.current = ac
    retryRef.current = () => { void saveActive() }
    try {
      await writeFile(workspace.workspaceId, active.path, active.buffer, ac.signal)
      if (ac.signal.aborted) return
      editorActions?.markSaved(active.path)
      bumpGitRefresh()
      setStatus(prev => (prev.kind === 'error' && prev.op === 'save' ? { kind: 'idle' } : prev))
    } catch (error: unknown) {
      if (ac.signal.aborted) return
      void error
      setStatus({ kind: 'error', op: 'save', message: t('editor.error.save') })
    }
  }, [tabs, activePath, workspace, writeFile, editorActions, bumpGitRefresh, t])

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
    setLspDiagnostics((prev) => {
      if (!prev.has(path)) return prev
      const next = new Map(prev)
      next.delete(path)
      return next
    })
    if (tabs.some(tab => tab.path === path)) editorActions?.closeTab(path)
  }, [tabs, editorActions])

  const handlePathRenamed = useCallback((oldPath: string, newPath: string, newName: string) => {
    setLspDiagnostics((prev) => {
      const items = prev.get(oldPath)
      if (items === undefined) return prev
      const next = new Map(prev)
      next.delete(oldPath)
      next.set(newPath, items)
      return next
    })
    editorActions?.renameTabPath(oldPath, newPath, newName)
  }, [editorActions])

  const handleCloseTab = useCallback((path: string) => {
    if (workspaceId !== undefined && dirtyGuard.requestCloseTab(workspaceId, path)) return
    closeLsp(path)
    editorActions?.closeTab(path)
  }, [dirtyGuard, workspaceId, editorActions, closeLsp])

  const beginTreeResize = useCallback(() => {
    const root = rootRef.current
    if (root === null) return
    const pane = root.querySelector('[data-file-tree-pane="true"]')
    const width = pane instanceof HTMLElement
      ? pane.getBoundingClientRect().width
      : treeWidthPx ?? 0
    treeDragBase.current = width
    if (treeWidthPx === null) setTreeWidthPx(width)
    setTreeDragging(true)
  }, [treeWidthPx])

  const dragTreeResize = useCallback((dx: number) => {
    const root = rootRef.current
    if (root === null) return
    const container = root.getBoundingClientRect().width
    setTreeWidthPx(clampTreeWidth(treeDragBase.current + dx, container))
  }, [])

  const endTreeResize = useCallback(() => {
    setTreeDragging(false)
  }, [])

  return (
    <div
      ref={rootRef}
      className={css.editorRoot}
      style={{ '--file-tree-default-width': `${TREE_WIDTH_DEFAULT}px` } as CSSProperties}
      data-surface="editor-surface"
      data-tree-dragging={treeDragging || undefined}
    >
      <FileTreePane
        workspace={workspace}
        listWorkspaceEntries={listWorkspaceEntries}
        gitStatus={gitStatus}
        deletePath={deletePath}
        renamePath={renamePath}
        createWorkspaceDirectory={createWorkspaceDirectory}
        writeFile={writeFile}
        t={t}
        collapsed={!treeVisible}
        treeWidthPx={treeWidthPx}
        onHide={() => { setTreeVisible(false) }}
        newFileTrigger={newFileTrigger}
        gitRefreshTrigger={gitRefreshTrigger}
        onPathDeleted={handlePathDeleted}
        onPathRenamed={handlePathRenamed}
        onOpenFile={(entry) => { void openEntry(entry) }}
        onDismissOpenFeedback={dismissOpenFeedback}
        diagnosticsByPath={lspDiagnostics}
        {...(activePath !== undefined ? { activeEditorPath: activePath } : {})}
      />
      {treeVisible && (
        <TreeSplitHandle
          ariaLabel={t('editor.tree.resize')}
          onStart={beginTreeResize}
          onDrag={dragTreeResize}
          onEnd={endTreeResize}
        />
      )}
      <EditorPane
        tabs={tabs}
        activePath={activePath}
        status={status}
        dark={dark}
        t={t}
        treeCollapsed={!treeVisible}
        onShowTree={() => { setTreeVisible(true) }}
        workspaceRoot={workspace?.path}
        onFocus={focusEditorTab}
        onClose={handleCloseTab}
        onBufferChange={(path, buffer) => {
          editorActions?.setBuffer(path, buffer)
          scheduleLspSync(path, buffer)
        }}
        diagnosticsByPath={lspDiagnostics}
        onHover={fetchLspHover}
        onRetry={() => { retryRef.current?.() }}
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
