/** Left-pane file tree: lazy listings, filename filter, type icons, Git badges, file ops. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import {
  Button, IconCloseFill14, IconFolderClose16, IconPlusOutline16, IconRefreshOutline14,
  IconSearchOutline16, IconChevronLeftOutline14, Input, Menu, Modal, Tooltip,
  useScrollRevealScrollbar,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  FileWriteResult, GitStatusListing, HostLspDiagnostic, PathMutationResult, WorkspaceEntriesListing, WorkspaceEntry,
  WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { FileTypeIcon } from './file-type-icon.tsx'
import { lspErrorCount } from './diagnostics-ui.ts'
import {
  directoryChainToFile, isPathInDirectorySubtree, joinChildPath, parentDirectoryForCreate,
  remapPathAfterRename,
  parentDirectoryOfEntry, parentDirectoryOfPath, siblingNameConflictKey,
} from './file-tree-parent.ts'
import { flattenVisibleTree, paintVisibleRows } from './flatten-visible.ts'
import { filterTreeEntries } from './tree-entry-filter.ts'
import { withDirectoryListingTimeout } from './directory-listing-timeout.ts'
import { rollupGitBadges } from './git-badge-rollup.ts'
import css from './FileTreePane.module.css'
import iconCss from './IconButton.module.css'
import dialogCss from './FileTreeDialogs.module.css'

const TOOLTIP_DELAY_MS = 500

/** Host listing and Git callbacks injected from WorkspaceRuntime. */
export interface FileTreeHost {
  /**
   * List one directory level inside the bound Workspace.
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
   * Read Git badge letters for the bound Workspace.
   * @param workspaceId - Workspace whose root is the git directory.
   * @param signal - aborts a superseded scan.
   */
  gitStatus: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<GitStatusListing>
}

/** Host path mutation callbacks for toolbar file operations. */
export interface FileTreeMutationHost {
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
   * Write UTF-8 text, creating the file when absent.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - body to write.
   * @param signal - aborts a superseded mutation.
   */
  writeFile: (
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    signal?: AbortSignal,
  ) => Promise<FileWriteResult>
}

type NameDialogKind = 'new-file' | 'new-folder' | 'rename'

interface NameDialogState {
  kind: NameDialogKind
  /** Entry being renamed. */
  entry?: WorkspaceEntry
  /** Explicit parent directory for toolbar-independent create operations. */
  createParent?: WorkspaceEntry
}

/** Props for the editor-surface file-tree pane. */
export interface FileTreePaneProps extends FileTreeHost, FileTreeMutationHost {
  /** Bound Workspace for the current Session; undefined when none is attached. */
  workspace: WorkspaceView | undefined
  /** Localized copy. */
  t: TranslateNS<'fileEditor'>
  /**
   * Open a file row in the editor pane. Directories are not opened.
   * @param entry - the clicked tree entry.
   */
  onOpenFile: (entry: WorkspaceEntry) => void
  /** Increment to open the new-file dialog from outside the toolbar. */
  newFileTrigger?: number
  /** Increment after disk writes so Git badges refresh without rebinding the Workspace. */
  gitRefreshTrigger?: number
  /** When true, refresh Git badges without the tree-top loading bar. */
  gitRefreshSilent?: boolean
  /** Increment after disk writes outside tree mutations so listings refresh. */
  explorerRefreshTrigger?: number
  /** Host-absolute path that changed; its parent listing reloads unless mode is visible. */
  explorerRefreshPath?: string
  /** `parent` reloads the parent of {@link explorerRefreshPath}; `visible` reloads root and expanded folders. */
  explorerRefreshMode?: 'parent' | 'visible'
  /** When true, the pane is visually collapsed (width 0). */
  collapsed?: boolean
  /** Hide the file tree pane. */
  onHide?: () => void
  /** Explicit tree width in pixels; omit to use the default ratio. */
  treeWidthPx?: number | null
  /**
   * Notify the editor pane that a path was deleted on disk.
   * @param path - deleted absolute path.
   */
  onPathDeleted?: (path: string) => void
  /**
   * Notify the editor pane that a path was renamed on disk.
   * @param oldPath - previous absolute path.
   * @param newPath - new absolute path.
   * @param newName - new base name.
   */
  onPathRenamed?: (oldPath: string, newPath: string, newName: string) => void
  /** Language-server diagnostics keyed by absolute file path. */
  diagnosticsByPath?: ReadonlyMap<string, readonly HostLspDiagnostic[]> | undefined
  /** Host-absolute path of the focused editor tab; reveals and selects the tree row. */
  activeEditorPath?: string
  /** Cancel a pending open/error overlay when the user navigates the tree without opening a file. */
  onDismissOpenFeedback?: () => void
}

const ROW_HEIGHT_PX = 22

/**
 * Whether a Host failure indicates a sibling name collision.
 * @param error - thrown Host error.
 * @returns true for `directory-exists` business failures.
 */
function isNameConflict(error: unknown): boolean {
  return error instanceof DirectoryBrowseError && error.rpcError.code === 'directory-exists'
}

/**
 * User-facing copy for Host create/rename failures caused by cross-kind path overlap.
 * @param error - thrown Host error.
 * @param t - file-editor copy.
 * @param kind - active name dialog mode.
 * @returns a field error string, or null when this helper does not apply.
 */
function crossKindPathError(
  error: unknown,
  t: TranslateNS<'fileEditor'>,
  kind: NameDialogKind,
): string | null {
  if (!(error instanceof DirectoryBrowseError)) return null
  const { code, message } = error.rpcError
  if ((kind === 'new-file' || kind === 'rename')
    && code === 'file-write-failed'
    && message.includes('directory already exists')) {
    return t('editor.error.folderNameConflict')
  }
  if (kind === 'new-folder'
    && code === 'directory-create-failed'
    && message.includes('file already exists')) {
    return t('editor.error.fileNameConflict')
  }
  if (kind === 'rename'
    && code === 'path-rename-failed'
    && message.includes('cannot share the same path')) {
    return t('editor.error.folderNameConflict')
  }
  return null
}

/**
 * File-tree pane: root listing follows the bound Workspace; folders load
 * children only when expanded; Git badges are read-only.
 * @param props - bound Workspace, Host callbacks, copy, and file-open callback.
 * @returns the filter chrome, toolbar, and virtualized tree.
 */
export function FileTreePane({
  workspace, listWorkspaceEntries, gitStatus, deletePath, renamePath,
  createWorkspaceDirectory, writeFile, t, onOpenFile, newFileTrigger = 0,
  gitRefreshTrigger = 0,
  gitRefreshSilent = false,
  explorerRefreshTrigger = 0,
  explorerRefreshPath,
  explorerRefreshMode = 'parent',
  collapsed = false, onHide, treeWidthPx = null,
  onPathDeleted, onPathRenamed, diagnosticsByPath, activeEditorPath, onDismissOpenFeedback,
}: FileTreePaneProps) {
  const [childrenByPath, setChildrenByPath] = useState<Map<string, readonly WorkspaceEntry[]>>(
    () => new Map(),
  )
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set())
  const [failedPaths, setFailedPaths] = useState<Set<string>>(() => new Set())
  const [truncatedPaths, setTruncatedPaths] = useState<Set<string>>(() => new Set())
  const [gitByPath, setGitByPath] = useState<Map<string, string>>(() => new Map())
  const [gitLoading, setGitLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined)
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceEntry | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [opError, setOpError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [treeMenu, setTreeMenu] = useState<{ entry: WorkspaceEntry; rect: DOMRect } | null>(null)
  const listingAbort = useRef<AbortController | null>(null)
  const fetchAbortByPath = useRef<Map<string, AbortController>>(new Map())
  const listWorkspaceEntriesRef = useRef(listWorkspaceEntries)
  listWorkspaceEntriesRef.current = listWorkspaceEntries
  const childrenByPathRef = useRef(childrenByPath)
  childrenByPathRef.current = childrenByPath
  const failedPathsRef = useRef(failedPaths)
  failedPathsRef.current = failedPaths
  const gitStatusRef = useRef(gitStatus)
  gitStatusRef.current = gitStatus
  const gitAbort = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { ref: scrollRevealRef, active: scrollActive } = useScrollRevealScrollbar()
  const treeScrollRef = useCallback((element: HTMLDivElement | null): void => {
    scrollRef.current = element
    scrollRevealRef(element)
  }, [scrollRevealRef])
  const composingRef = useRef(false)

  const selectedEntry = useMemo(() => {
    if (selectedPath === undefined || workspace === undefined) return undefined
    for (const entries of childrenByPath.values()) {
      const hit = entries.find(entry => entry.path === selectedPath)
      if (hit !== undefined) return hit
    }
    return undefined
  }, [selectedPath, childrenByPath, workspace])

  const clearLoadingPath = useCallback((dirPath: string): void => {
    setLoadingPaths((current) => {
      if (!current.has(dirPath)) return current
      const next = new Set(current)
      next.delete(dirPath)
      return next
    })
  }, [])

  const clearLoadingPathRef = useRef(clearLoadingPath)
  clearLoadingPathRef.current = clearLoadingPath

  const fetchDirectory = useCallback(async (
    dirPath: string,
    options: { force?: boolean } = {},
  ): Promise<readonly WorkspaceEntry[]> => {
    if (workspace === undefined) return []
    if (
      !options.force
      && childrenByPathRef.current.has(dirPath)
      && !failedPathsRef.current.has(dirPath)
    ) {
      fetchAbortByPath.current.get(dirPath)?.abort()
      fetchAbortByPath.current.delete(dirPath)
      clearLoadingPath(dirPath)
      return childrenByPathRef.current.get(dirPath) ?? []
    }
    fetchAbortByPath.current.get(dirPath)?.abort()
    const ac = new AbortController()
    fetchAbortByPath.current.set(dirPath, ac)
    setLoadingPaths(current => new Set(current).add(dirPath))
    setFailedPaths((current) => {
      if (!current.has(dirPath)) return current
      const next = new Set(current)
      next.delete(dirPath)
      return next
    })
    try {
      if (ac.signal.aborted && fetchAbortByPath.current.get(dirPath) !== ac) return []
      const listing = await withDirectoryListingTimeout(
        listWorkspaceEntriesRef.current(workspace.workspaceId, dirPath, ac.signal),
        ac,
      )
      if (fetchAbortByPath.current.get(dirPath) !== ac) return []
      const entries = filterTreeEntries(listing.entries)
      setChildrenByPath(current => new Map(current).set(dirPath, entries))
      setTruncatedPaths((current) => {
        const next = new Set(current)
        if (listing.truncated) next.add(dirPath)
        else next.delete(dirPath)
        return next
      })
      clearLoadingPath(dirPath)
      return entries
    } catch (error: unknown) {
      if (fetchAbortByPath.current.get(dirPath) !== ac) return []
      void error
      setChildrenByPath(current => new Map(current).set(dirPath, []))
      setFailedPaths(current => new Set(current).add(dirPath))
      clearLoadingPath(dirPath)
      return []
    } finally {
      if (fetchAbortByPath.current.get(dirPath) === ac) {
        fetchAbortByPath.current.delete(dirPath)
      }
    }
  }, [workspace, clearLoadingPath])

  const fetchDirectoryRef = useRef(fetchDirectory)
  fetchDirectoryRef.current = fetchDirectory

  const invalidateDirectory = useCallback(async (dirPath: string) => {
    setChildrenByPath((current) => {
      const next = new Map(current)
      next.delete(dirPath)
      return next
    })
    setFailedPaths((current) => {
      if (!current.has(dirPath)) return current
      const next = new Set(current)
      next.delete(dirPath)
      return next
    })
    setTruncatedPaths((current) => {
      if (!current.has(dirPath)) return current
      const next = new Set(current)
      next.delete(dirPath)
      return next
    })
    if (workspace === undefined) return
    await fetchDirectory(dirPath, { force: true })
  }, [workspace, fetchDirectory])

  const purgeCachedSubtree = useCallback((directoryPath: string) => {
    const matches = (path: string): boolean => isPathInDirectorySubtree(directoryPath, path)
    for (const [path, controller] of fetchAbortByPath.current) {
      if (!matches(path)) continue
      controller.abort()
      fetchAbortByPath.current.delete(path)
    }
    setChildrenByPath((current) => {
      let changed = false
      const next = new Map(current)
      for (const path of current.keys()) {
        if (!matches(path)) continue
        next.delete(path)
        changed = true
      }
      return changed ? next : current
    })
    setExpanded((current) => {
      let changed = false
      const next = new Set<string>()
      for (const path of current) {
        if (matches(path)) {
          changed = true
          continue
        }
        next.add(path)
      }
      return changed ? next : current
    })
    setLoadingPaths((current) => {
      let changed = false
      const next = new Set<string>()
      for (const path of current) {
        if (matches(path)) {
          changed = true
          continue
        }
        next.add(path)
      }
      return changed ? next : current
    })
    setFailedPaths((current) => {
      let changed = false
      const next = new Set<string>()
      for (const path of current) {
        if (matches(path)) {
          changed = true
          continue
        }
        next.add(path)
      }
      return changed ? next : current
    })
    setTruncatedPaths((current) => {
      let changed = false
      const next = new Set<string>()
      for (const path of current) {
        if (matches(path)) {
          changed = true
          continue
        }
        next.add(path)
      }
      return changed ? next : current
    })
    setSelectedPath(current => (
      current !== undefined && matches(current) ? undefined : current
    ))
  }, [])

  const boundWorkspaceId = workspace?.workspaceId
  const boundWorkspacePath = workspace?.path

  const refreshGitStatus = useCallback(async (options: { silent?: boolean } = {}) => {
    if (workspace === undefined) return
    gitAbort.current?.abort()
    const ac = new AbortController()
    gitAbort.current = ac
    if (!options.silent) setGitLoading(true)
    try {
      const listing = await gitStatusRef.current(workspace.workspaceId, ac.signal)
      if (ac.signal.aborted) return
      setGitByPath(rollupGitBadges(
        new Map(listing.entries.map(entry => [entry.path, entry.letter])),
        workspace.path,
      ))
    } catch (error: unknown) {
      if (ac.signal.aborted) return
      void error
      setGitByPath(new Map())
    } finally {
      if (!ac.signal.aborted && !options.silent) setGitLoading(false)
    }
  }, [workspace])

  const refreshExplorer = useCallback(async (): Promise<void> => {
    if (workspace === undefined) return
    await fetchDirectory(workspace.path, { force: true })
    void refreshGitStatus()
  }, [workspace, fetchDirectory, refreshGitStatus])

  const refreshVisibleDirectories = useCallback(async (): Promise<void> => {
    if (workspace === undefined) return
    const dirs = [workspace.path, ...expandedRef.current]
    for (const dirPath of dirs) {
      await fetchDirectory(dirPath, { force: true })
    }
    void refreshGitStatus()
  }, [workspace, fetchDirectory, refreshGitStatus])

  useEffect(() => {
    const ac = new AbortController()
    listingAbort.current = ac
    for (const controller of fetchAbortByPath.current.values()) {
      controller.abort()
    }
    fetchAbortByPath.current.clear()
    gitAbort.current?.abort()
    gitAbort.current = null
    setChildrenByPath(new Map())
    setExpanded(new Set())
    setLoadingPaths(new Set())
    setFailedPaths(new Set())
    setTruncatedPaths(new Set())
    setGitByPath(new Map())
    setSelectedPath(undefined)
    setFilter('')
    setNameDialog(null)
    setDeleteTarget(null)
    setNameDraft('')
    setNameError(null)
    setOpError(null)
    setSubmitting(false)
    if (boundWorkspaceId === undefined || boundWorkspacePath === undefined) {
      setGitLoading(false)
      return () => { ac.abort() }
    }
    void listWorkspaceEntriesRef.current(boundWorkspaceId, boundWorkspacePath, ac.signal)
      .then((listing) => {
        if (ac.signal.aborted) return
        setChildrenByPath(new Map([[boundWorkspacePath, filterTreeEntries(listing.entries)]]))
        setTruncatedPaths(listing.truncated ? new Set([boundWorkspacePath]) : new Set())
      })
      .catch((error: unknown) => {
        if (ac.signal.aborted) return
        void error
        setChildrenByPath(new Map([[boundWorkspacePath, []]]))
        setFailedPaths(new Set([boundWorkspacePath]))
      })
    void (async () => {
      if (boundWorkspaceId === undefined || boundWorkspacePath === undefined) return
      gitAbort.current?.abort()
      const gitAc = new AbortController()
      gitAbort.current = gitAc
      setGitLoading(true)
      try {
        const listing = await gitStatusRef.current(boundWorkspaceId, gitAc.signal)
        if (gitAc.signal.aborted) return
        setGitByPath(rollupGitBadges(
          new Map(listing.entries.map(entry => [entry.path, entry.letter])),
          boundWorkspacePath,
        ))
      } catch (error: unknown) {
        if (gitAc.signal.aborted) return
        void error
        setGitByPath(new Map())
      } finally {
        if (!gitAc.signal.aborted) setGitLoading(false)
      }
    })()
    return () => {
      ac.abort()
      gitAbort.current?.abort()
    }
  }, [boundWorkspaceId, boundWorkspacePath])

  useEffect(() => {
    if (gitRefreshTrigger === 0) return
    void refreshGitStatus({ silent: gitRefreshSilent })
  }, [gitRefreshTrigger, gitRefreshSilent, refreshGitStatus])

  useEffect(() => {
    if (explorerRefreshTrigger === 0 || workspace === undefined) return
    if (explorerRefreshMode === 'visible') {
      void refreshVisibleDirectories()
      return
    }
    if (explorerRefreshPath === undefined) return
    const parent = parentDirectoryOfPath(workspace.path, explorerRefreshPath)
    void invalidateDirectory(parent)
  }, [
    explorerRefreshTrigger,
    explorerRefreshPath,
    explorerRefreshMode,
    workspace,
    invalidateDirectory,
    refreshVisibleDirectories,
  ])

  useEffect(() => {
    if (newFileTrigger === 0 || workspace === undefined) return
    setNameDialog({ kind: 'new-file' })
    setNameDraft('')
    setNameError(null)
    setOpError(null)
  }, [newFileTrigger, workspace])

  useEffect(() => {
    setLoadingPaths((current) => {
      if (current.size === 0) return current
      let changed = false
      const next = new Set<string>()
      for (const path of current) {
        if (childrenByPath.has(path) && !failedPaths.has(path)) {
          changed = true
          continue
        }
        next.add(path)
      }
      return changed ? next : current
    })
  }, [childrenByPath, failedPaths])

  const toggleDirectory = useCallback(async (entry: WorkspaceEntry) => {
    if (!entry.isDirectory || workspace === undefined) return
    onDismissOpenFeedback?.()
    if (expanded.has(entry.path)) {
      fetchAbortByPath.current.get(entry.path)?.abort()
      fetchAbortByPath.current.delete(entry.path)
      clearLoadingPath(entry.path)
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
      return
    }
    setExpanded(current => new Set(current).add(entry.path))
    if (childrenByPath.has(entry.path) && !failedPaths.has(entry.path)) {
      clearLoadingPath(entry.path)
      return
    }
    await fetchDirectory(entry.path)
  }, [workspace, expanded, childrenByPath, failedPaths, fetchDirectory, clearLoadingPath, onDismissOpenFeedback])

  const workspaceBound = workspace !== undefined
  const rootEntries = workspace === undefined
    ? []
    : (childrenByPath.get(workspace.path) ?? [])
  const rootLoaded = workspace !== undefined && childrenByPath.has(workspace.path)
  const rootPending = workspace !== undefined && !rootLoaded
  const rows = useMemo(
    () => flattenVisibleTree(rootEntries, expanded, loadingPaths, childrenByPath, filter),
    [rootEntries, expanded, loadingPaths, childrenByPath, filter],
  )
  const showTreeEmpty = filter.trim() === '' && !rootPending && (
    workspace === undefined || rootEntries.length === 0
  )
  const filterNoMatch = rootLoaded && rootEntries.length > 0 && filter.trim() !== '' && rows.length === 0

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 16,
    initialRect: { width: 280, height: 400 },
  })
  const virtualItems = virtualizer.getVirtualItems()
  const paintedRows = paintVisibleRows(rows, virtualItems, ROW_HEIGHT_PX)

  useEffect(() => {
    if (workspace === undefined || activeEditorPath === undefined) return
    const chain = directoryChainToFile(workspace.path, activeEditorPath)
    if (chain.length === 0) return
    let cancelled = false
    void (async () => {
      for (const dirPath of chain) {
        if (cancelled) return
        setExpanded(current => new Set(current).add(dirPath))
        await fetchDirectoryRef.current(dirPath)
        if (cancelled) return
      }
      if (cancelled) return
      setSelectedPath(activeEditorPath)
    })()
    return () => {
      cancelled = true
      for (const dirPath of chain) {
        if (childrenByPathRef.current.has(dirPath) && !failedPathsRef.current.has(dirPath)) {
          clearLoadingPathRef.current(dirPath)
        }
      }
    }
  }, [workspace, activeEditorPath])

  useEffect(() => {
    if (activeEditorPath === undefined || selectedPath !== activeEditorPath) return
    const index = rows.findIndex(row => row.entry.path === activeEditorPath)
    if (index < 0) return
    virtualizer.scrollToIndex(index, { align: 'auto' })
  }, [activeEditorPath, selectedPath, rows, virtualizer])

  const clearFilter = (): void => { setFilter('') }

  const openNameDialog = (
    kind: NameDialogKind,
    options: { entry?: WorkspaceEntry; createParent?: WorkspaceEntry } = {},
  ): void => {
    const dialog: NameDialogState = { kind }
    if (options.entry !== undefined) dialog.entry = options.entry
    if (options.createParent !== undefined) dialog.createParent = options.createParent
    setNameDialog(dialog)
    setNameDraft(options.entry?.name ?? '')
    setNameError(null)
    setOpError(null)
  }

  const closeNameDialog = (): void => {
    if (submitting) return
    setNameDialog(null)
    setNameDraft('')
    setNameError(null)
    setOpError(null)
  }

  const closeDeleteDialog = (): void => {
    if (submitting) return
    setDeleteTarget(null)
    setOpError(null)
  }

  const submitNameDialog = async (): Promise<void> => {
    if (workspace === undefined || nameDialog === null || submitting) return
    const trimmed = nameDraft.trim()
    if (trimmed === '') return
    setSubmitting(true)
    setNameError(null)
    setOpError(null)
    try {
      if (nameDialog.kind === 'rename') {
        const entry = nameDialog.entry
        if (entry === undefined || trimmed === entry.name) {
          closeNameDialog()
          return
        }
        const parent = parentDirectoryOfEntry(workspace.path, entry)
        const siblings = await fetchDirectory(parent, { force: true })
        const renameConflict = siblingNameConflictKey(
          siblings.filter(item => item.path !== entry.path),
          trimmed,
          entry.isDirectory,
        )
        if (renameConflict !== null) {
          setNameError(t(renameConflict))
          return
        }
        const result = await renamePath(workspace.workspaceId, entry.path, trimmed)
        if (entry.isDirectory) {
          purgeCachedSubtree(entry.path)
          setExpanded((current) => {
            const next = new Set<string>()
            for (const path of current) {
              next.add(remapPathAfterRename(entry.path, result.path, path))
            }
            return next
          })
        }
        await invalidateDirectory(parent)
        onPathRenamed?.(entry.path, result.path, trimmed)
        setSelectedPath(result.path)
        setNameDialog(null)
        setNameDraft('')
        void refreshGitStatus()
        return
      }
      const parent = nameDialog.createParent !== undefined
        ? nameDialog.createParent.path
        : parentDirectoryForCreate(workspace.path, selectedEntry)
      const siblings = await fetchDirectory(parent, { force: true })
      const createConflict = siblingNameConflictKey(
        siblings,
        trimmed,
        nameDialog.kind === 'new-folder',
      )
      if (createConflict !== null) {
        setNameError(t(createConflict))
        return
      }
      const childPath = joinChildPath(parent, trimmed)
      if (nameDialog.kind === 'new-folder') {
        const result = await createWorkspaceDirectory(workspace.workspaceId, parent, trimmed)
        await invalidateDirectory(parent)
        setExpanded(current => new Set(current).add(parent))
        setSelectedPath(result.path)
        setNameDialog(null)
        setNameDraft('')
        void refreshGitStatus()
        return
      }
      await writeFile(workspace.workspaceId, childPath, '')
      await invalidateDirectory(parent)
      const created: WorkspaceEntry = {
        name: trimmed,
        path: childPath,
        isDirectory: false,
        hidden: trimmed.startsWith('.'),
      }
      setSelectedPath(childPath)
      onOpenFile(created)
      setNameDialog(null)
      setNameDraft('')
      void refreshGitStatus()
    } catch (error: unknown) {
      const crossKind = crossKindPathError(error, t, nameDialog.kind)
      if (crossKind !== null) {
        setNameError(crossKind)
        return
      }
      if (isNameConflict(error)) {
        const folderTarget = nameDialog.kind === 'new-folder'
          || (nameDialog.kind === 'rename' && nameDialog.entry?.isDirectory === true)
        setNameError(t(folderTarget
          ? 'editor.error.folderNameConflict'
          : 'editor.error.fileNameConflict'))
        return
      }
      if (nameDialog.kind === 'rename') setOpError(t('editor.error.rename'))
      else if (nameDialog.kind === 'new-folder') setOpError(t('editor.error.createFolder'))
      else setOpError(t('editor.error.createFile'))
      void error
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (workspace === undefined || deleteTarget === null || submitting) return
    setSubmitting(true)
    setOpError(null)
    const deletedPath = deleteTarget.path
    try {
      const parent = parentDirectoryOfEntry(workspace.path, deleteTarget)
      await deletePath(workspace.workspaceId, deletedPath)
      if (deleteTarget.isDirectory) purgeCachedSubtree(deletedPath)
      else if (selectedPath === deletedPath) setSelectedPath(undefined)
      await invalidateDirectory(parent)
      setDeleteTarget(null)
      void refreshGitStatus()
      onPathDeleted?.(deletedPath)
    } catch (error: unknown) {
      void error
      setOpError(t('editor.error.delete'))
    } finally {
      setSubmitting(false)
    }
  }

  const nameDialogTitle = nameDialog?.kind === 'new-file'
    ? t('editor.dialog.newFile.title')
    : nameDialog?.kind === 'new-folder'
      ? t('editor.dialog.newFolder.title')
      : t('editor.dialog.rename.title')
  const nameDialogConfirm = nameDialog?.kind === 'rename'
    ? t('editor.dialog.rename.confirm')
    : t('editor.dialog.create')
  const nameInputError = nameError !== null

  const treeLabel = workspace?.title ?? t('editor.tree.label')
  const workspaceHeader = treeLabel

  const treeContextMenuItems = useMemo((): readonly MenuEntry[] => {
    if (treeMenu?.entry.isDirectory) {
      return [
        { id: 'new-file', label: t('editor.tree.newFile') },
        { id: 'new-folder', label: t('editor.tree.newSubfolder') },
        { type: 'separator', id: 'tree-create-sep' },
        { id: 'rename', label: t('editor.tree.rename') },
        { id: 'delete', label: t('editor.tree.delete'), danger: true },
      ]
    }
    return [
      { id: 'rename', label: t('editor.tree.rename') },
      { id: 'delete', label: t('editor.tree.delete'), danger: true },
    ]
  }, [t, treeMenu?.entry])

  return (
    <div
      className={clsx(
        css.pane,
        collapsed && css.paneCollapsed,
        treeWidthPx !== null && css.paneResized,
      )}
      style={treeWidthPx !== null ? { width: treeWidthPx } : undefined}
      data-file-tree-pane="true"
      aria-hidden={collapsed || undefined}
    >
      {gitLoading
        ? <div className={css.gitBar} role="progressbar" aria-label={t('editor.tree.git.loading')} />
        : <div className={css.gitBarSlot} />}
      <div className={css.filterRow}>
        <div className={css.filterField}>
          <Input
            icon={<IconSearchOutline16 size={14} />}
            className={css.filterInput as string}
            value={filter}
            placeholder={t('editor.tree.filter.placeholder')}
            aria-label={t('editor.tree.filter.placeholder')}
            onChange={(event) => { setFilter(event.target.value) }}
          />
          {filter !== '' && (
            <Tooltip label={t('editor.tree.filter.clear')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
              <button
                type="button"
                className={clsx(iconCss.disclosureButton, css.filterIconClear)}
                aria-label={t('editor.tree.filter.clear')}
                onClick={clearFilter}
              >
                <IconCloseFill14 size={12} />
              </button>
            </Tooltip>
          )}
        </div>
        {onHide !== undefined && (
          <Tooltip label={t('editor.tree.hide')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
            <button
              type="button"
              className={clsx(iconCss.iconButton, iconCss.iconButtonSm, css.treeToggleAnchor)}
              aria-label={t('editor.tree.hide')}
              onClick={onHide}
            >
              <IconChevronLeftOutline14 size={14} />
            </button>
          </Tooltip>
        )}
      </div>
      <div className={css.toolbar} data-file-tree-toolbar="true">
        <div className={css.toolbarTitle} title={workspaceHeader}>
          {workspaceHeader}
        </div>
        <div className={css.toolbarActions}>
          <Tooltip label={t('editor.tree.newFile')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
            <button
              type="button"
              className={clsx(iconCss.iconButton, iconCss.iconButtonSm, css.toolbarIconButton)}
              aria-label={t('editor.tree.newFile')}
              aria-disabled={!workspaceBound || undefined}
              onClick={workspaceBound ? () => { openNameDialog('new-file') } : undefined}
            >
              <IconPlusOutline16 size={14} />
            </button>
          </Tooltip>
          <Tooltip label={t('editor.tree.newFolder')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
            <button
              type="button"
              className={clsx(iconCss.iconButton, iconCss.iconButtonSm, css.toolbarIconButton)}
              aria-label={t('editor.tree.newFolder')}
              aria-disabled={!workspaceBound || undefined}
              onClick={workspaceBound ? () => { openNameDialog('new-folder') } : undefined}
            >
              <IconFolderClose16 size={14} />
            </button>
          </Tooltip>
          <Tooltip label={t('editor.tree.refresh')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
            <button
              type="button"
              className={clsx(iconCss.iconButton, iconCss.iconButtonSm, css.toolbarIconButton)}
              aria-label={t('editor.tree.refresh')}
              aria-disabled={!workspaceBound || undefined}
              onClick={workspaceBound ? () => { void refreshExplorer() } : undefined}
            >
              <IconRefreshOutline14 />
            </button>
          </Tooltip>
        </div>
      </div>
      <div
        className={clsx(css.treeScroll, scrollActive && css.treeScrollActive)}
        ref={treeScrollRef}
        data-tree-scroll="true"
        data-empty={showTreeEmpty || undefined}
      >
        {showTreeEmpty && (
          <div className={css.empty}>
            <div className={css.emptyTitle}>{t('editor.tree.empty.title')}</div>
          </div>
        )}
        {filterNoMatch && (
          <div className={css.empty}>
            <div className={css.emptyTitle}>{t('editor.tree.filter.noMatch')}</div>
            <Tooltip label={t('editor.tree.filter.clear')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
              <button type="button" className={iconCss.ghostTextButton} onClick={clearFilter}>
                {t('editor.tree.filter.clear')}
              </button>
            </Tooltip>
          </div>
        )}
        {!showTreeEmpty && (
          <div
            role="tree"
            aria-label={treeLabel}
            className={css.tree}
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {paintedRows.map(({ row, start }) => {
              const letter = gitByPath.get(row.entry.path)
              const selected = selectedPath === row.entry.path
              const errorCount = row.entry.isDirectory
                ? 0
                : lspErrorCount(diagnosticsByPath?.get(row.entry.path))
              return (
                <div
                  key={row.entry.path}
                  role="treeitem"
                  aria-expanded={row.entry.isDirectory ? row.expanded : undefined}
                  aria-selected={selected}
                  aria-level={row.depth + 1}
                  aria-busy={row.loading || undefined}
                  className={clsx(css.row, selected && css.rowSelected)}
                  style={{
                    transform: `translateY(${start}px)`,
                    paddingLeft: `${row.depth * 12}px`,
                  }}
                  onClick={() => {
                    setSelectedPath(row.entry.path)
                    if (row.entry.isDirectory) void toggleDirectory(row.entry)
                    else onOpenFile(row.entry)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setSelectedPath(row.entry.path)
                    setTreeMenu({
                      entry: row.entry,
                      rect: event.currentTarget.getBoundingClientRect(),
                    })
                  }}
                >
                  {row.entry.isDirectory
                    ? (
                      <Tooltip
                        label={row.expanded
                          ? t('editor.tree.collapse', { name: row.entry.name })
                          : t('editor.tree.expand', { name: row.entry.name })}
                        side="bottom"
                        delayMs={TOOLTIP_DELAY_MS}
                      >
                        <button
                          type="button"
                          className={iconCss.disclosureButton}
                          aria-label={row.expanded
                            ? t('editor.tree.collapse', { name: row.entry.name })
                            : t('editor.tree.expand', { name: row.entry.name })}
                          onClick={(event) => {
                            event.stopPropagation()
                            void toggleDirectory(row.entry)
                          }}
                        >
                          <span className={clsx(css.chevron, row.expanded && css.chevronOpen)} />
                        </button>
                      </Tooltip>
                    )
                    : <span className={css.disclosureSpacer} />}
                  <FileTypeIcon entry={row.entry} expanded={row.expanded} t={t} />
                  <span className={clsx(css.name, errorCount > 0 && css.nameError)}>{row.entry.name}</span>
                  {errorCount > 0 && (
                    <span className={css.errorCount} aria-label={t('editor.tab.errors', { count: errorCount })}>
                      {errorCount}
                    </span>
                  )}
                  {letter !== undefined && (
                    <span className={clsx(css.badge, badgeClass(letter))} aria-label={t('editor.tree.git.badge', { letter })}>
                      {letter}
                    </span>
                  )}
                  {row.loading && (
                    <span className={css.spinner} role="status" aria-label={t('editor.tree.loading')} />
                  )}
                  {!row.loading && failedPaths.has(row.entry.path) && (
                    <span className={css.listError} role="status" aria-label={t('editor.tree.listError')}>
                      !
                    </span>
                  )}
                  {!row.loading && truncatedPaths.has(row.entry.path) && (
                    <span className={css.truncatedHint} aria-label={t('editor.tree.truncated')}>…</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {treeMenu !== null && (
        <Menu
          open
          portal
          compact
          align="start"
          side="bottom"
          anchor={<span aria-hidden="true" />}
          items={treeContextMenuItems}
          onSelect={(id) => {
            const entry = treeMenu.entry
            if (id === 'new-file') {
              setSelectedPath(entry.path)
              setExpanded(current => new Set(current).add(entry.path))
              openNameDialog('new-file', { createParent: entry })
            }
            if (id === 'new-folder') {
              setSelectedPath(entry.path)
              setExpanded(current => new Set(current).add(entry.path))
              openNameDialog('new-folder', { createParent: entry })
            }
            if (id === 'rename') openNameDialog('rename', { entry })
            if (id === 'delete') {
              setDeleteTarget(entry)
              setOpError(null)
            }
            setTreeMenu(null)
          }}
          onClose={() => { setTreeMenu(null) }}
          getAnchorRect={() => treeMenu.rect}
        />
      )}
      <Modal
        open={nameDialog !== null}
        onClose={closeNameDialog}
        closeLabel={t('editor.dialog.close')}
        title={nameDialogTitle}
        className={dialogCss.dialogSurface ?? ''}
        footer={(
          <>
            <Button variant="outline" disabled={submitting} onClick={closeNameDialog}>
              {t('editor.dialog.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={submitting || nameDraft.trim() === ''}
              onClick={() => { void submitNameDialog() }}
            >
              {nameDialogConfirm}
            </Button>
          </>
        )}
      >
        <input
          className={clsx(dialogCss.nameInput, nameInputError && dialogCss.nameInputError)}
          value={nameDraft}
          aria-label={t('editor.dialog.name.label')}
          aria-invalid={nameInputError || undefined}
          autoFocus
          disabled={submitting}
          onFocus={(event) => { event.target.select() }}
          onChange={(event) => {
            setNameDraft(event.target.value)
            setNameError(null)
            setOpError(null)
          }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !composingRef.current) {
              event.preventDefault()
              void submitNameDialog()
            }
          }}
        />
        {nameError !== null && (
          <div className={dialogCss.fieldError} role="alert">{nameError}</div>
        )}
        {opError !== null && (
          <div className={dialogCss.fieldError} role="alert">{opError}</div>
        )}
      </Modal>
      <Modal
        open={deleteTarget !== null}
        onClose={closeDeleteDialog}
        closeLabel={t('editor.dialog.close')}
        title={t('editor.dialog.delete.title')}
        className={dialogCss.dialogSurface ?? ''}
        {...deleteTarget === null
          ? {}
          : { description: t('editor.dialog.delete.desc', { path: deleteTarget.path }) }}
        footer={(
          <>
            <Button variant="outline" disabled={submitting} onClick={closeDeleteDialog}>
              {t('editor.dialog.cancel')}
            </Button>
            <Button
              variant="outline"
              className={dialogCss.deleteAction}
              disabled={submitting}
              onClick={() => { void confirmDelete() }}
            >
              {t('editor.dialog.delete.confirm')}
            </Button>
          </>
        )}
      >
        {opError !== null && (
          <div className={dialogCss.fieldError} role="alert">{opError}</div>
        )}
      </Modal>
    </div>
  )
}

/**
 * Map a Git badge letter to its DESIGN color class.
 * @param letter - Host badge letter (M / U / D / other).
 * @returns a CSS module class for that letter.
 */
function badgeClass(letter: string): string {
  if (letter === 'M') return css.badgeModified as string
  if (letter === 'D') return css.badgeDeleted as string
  return css.badgeUntracked as string
}
