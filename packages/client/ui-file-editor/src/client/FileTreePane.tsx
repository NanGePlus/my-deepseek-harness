/** Left-pane file tree: lazy listings, filename filter, type icons, Git badges. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import {
  IconCloseOutline16, IconFolderClose16, IconPlusOutline16, IconSearchOutline16, Input,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  GitStatusListing, WorkspaceEntriesListing, WorkspaceEntry, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { FileTypeIcon } from './file-type-icon.tsx'
import { flattenVisibleTree, paintVisibleRows } from './flatten-visible.ts'
import css from './FileTreePane.module.css'

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

/** Props for the editor-surface file-tree pane. */
export interface FileTreePaneProps extends FileTreeHost {
  /** Bound Workspace for the current Session; undefined when none is attached. */
  workspace: WorkspaceView | undefined
  /** Localized copy. */
  t: TranslateNS<'fileEditor'>
  /**
   * Open a file row in the editor pane. Directories are not opened.
   * @param entry - the clicked tree entry.
   */
  onOpenFile: (entry: WorkspaceEntry) => void
}

const ROW_HEIGHT_PX = 22

/**
 * File-tree pane: root listing follows the bound Workspace; folders load
 * children only when expanded; Git badges are read-only.
 * @param props - bound Workspace, Host callbacks, copy, and file-open callback.
 * @returns the filter chrome, toolbar, and virtualized tree.
 */
export function FileTreePane({
  workspace, listWorkspaceEntries, gitStatus, t, onOpenFile,
}: FileTreePaneProps) {
  const [childrenByPath, setChildrenByPath] = useState<Map<string, readonly WorkspaceEntry[]>>(
    () => new Map(),
  )
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set())
  const [gitByPath, setGitByPath] = useState<Map<string, string>>(() => new Map())
  const [gitLoading, setGitLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined)
  const listingAbort = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ac = new AbortController()
    listingAbort.current = ac
    setChildrenByPath(new Map())
    setExpanded(new Set())
    setLoadingPaths(new Set())
    setGitByPath(new Map())
    setSelectedPath(undefined)
    setFilter('')
    if (workspace === undefined) {
      setGitLoading(false)
      return () => { ac.abort() }
    }
    setGitLoading(true)
    void listWorkspaceEntries(workspace.workspaceId, workspace.path, ac.signal)
      .then((listing) => {
        if (ac.signal.aborted) return
        setChildrenByPath(new Map([[workspace.path, listing.entries]]))
      })
      .catch((error: unknown) => {
        // A superseded listing or unmount aborts; other listing failures have
        // no tree-error state in this slice, so the pane stays at the last cache.
        if (ac.signal.aborted) return
        void error
      })
    void gitStatus(workspace.workspaceId, ac.signal)
      .then((listing) => {
        if (ac.signal.aborted) return
        setGitByPath(new Map(listing.entries.map(entry => [entry.path, entry.letter])))
      })
      .catch((error: unknown) => {
        // Host gitStatus returns [] for a non-repo; a thrown RPC still must
        // not surface an error — the tree stays usable without badges.
        if (ac.signal.aborted) return
        setGitByPath(new Map())
        void error
      })
      .finally(() => {
        if (!ac.signal.aborted) setGitLoading(false)
      })
    return () => {
      ac.abort()
    }
  }, [workspace, listWorkspaceEntries, gitStatus])

  const toggleDirectory = useCallback(async (entry: WorkspaceEntry) => {
    if (!entry.isDirectory || workspace === undefined) return
    if (expanded.has(entry.path)) {
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
      return
    }
    setExpanded(current => new Set(current).add(entry.path))
    if (childrenByPath.has(entry.path)) return
    setLoadingPaths(current => new Set(current).add(entry.path))
    try {
      const listing = await listWorkspaceEntries(
        workspace.workspaceId,
        entry.path,
        listingAbort.current?.signal,
      )
      if (listingAbort.current?.signal.aborted) return
      setChildrenByPath(current => new Map(current).set(entry.path, listing.entries))
    } catch (error: unknown) {
      if (listingAbort.current?.signal.aborted) return
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
      void error
    } finally {
      setLoadingPaths((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
    }
  }, [workspace, expanded, childrenByPath, listWorkspaceEntries])

  const rootEntries = workspace === undefined
    ? []
    : (childrenByPath.get(workspace.path) ?? [])
  const rootLoaded = workspace !== undefined && childrenByPath.has(workspace.path)
  const rows = useMemo(
    () => flattenVisibleTree(rootEntries, expanded, loadingPaths, childrenByPath, filter),
    [rootEntries, expanded, loadingPaths, childrenByPath, filter],
  )
  const emptyWorkspace = rootLoaded && rootEntries.length === 0 && filter.trim() === ''
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

  const clearFilter = (): void => { setFilter('') }
  const treeLabel = workspace?.title ?? t('editor.tree.label')

  return (
    <div className={css.pane}>
      {gitLoading
        ? <div className={css.gitBar} role="progressbar" aria-label={t('editor.tree.git.loading')} />
        : <div className={css.gitBarSlot} />}
      <div className={css.filterRow}>
        <Input
          icon={<IconSearchOutline16 size={16} />}
          className={css.filterInput as string}
          value={filter}
          placeholder={t('editor.tree.filter.placeholder')}
          aria-label={t('editor.tree.filter.placeholder')}
          onChange={(event) => { setFilter(event.target.value) }}
        />
        {filter !== '' && (
          <button
            type="button"
            className={css.filterIconClear}
            aria-label={t('editor.tree.filter.clear')}
            onClick={clearFilter}
          >
            <IconCloseOutline16 size={16} />
          </button>
        )}
      </div>
      <div className={css.toolbar}>
        <button type="button" className={css.toolButton} disabled aria-label={t('editor.tree.newFile')}>
          <IconPlusOutline16 size={16} />
        </button>
        <button type="button" className={css.toolButton} disabled aria-label={t('editor.tree.newFolder')}>
          <IconFolderClose16 size={16} />
        </button>
      </div>
      <div className={css.treeScroll} ref={scrollRef} data-tree-scroll="true">
        {emptyWorkspace && (
          <div className={css.empty}>
            <div className={css.emptyTitle}>{t('editor.tree.empty.title')}</div>
            <button type="button" className={css.emptyCta} disabled>{t('editor.tree.empty.cta')}</button>
          </div>
        )}
        {filterNoMatch && (
          <div className={css.empty}>
            <div className={css.emptyTitle}>{t('editor.tree.filter.noMatch')}</div>
            <button type="button" className={css.textClear} onClick={clearFilter}>
              {t('editor.tree.filter.clear')}
            </button>
          </div>
        )}
        <div
          role="tree"
          aria-label={treeLabel}
          className={css.tree}
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {paintedRows.map(({ row, start }) => {
            const letter = gitByPath.get(row.entry.path)
            const selected = selectedPath === row.entry.path
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
                  if (!row.entry.isDirectory) onOpenFile(row.entry)
                }}
                onDoubleClick={() => { void toggleDirectory(row.entry) }}
              >
                {row.entry.isDirectory
                  ? (
                    <button
                      type="button"
                      className={css.disclosure}
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
                  )
                  : <span className={css.disclosureSpacer} />}
                <FileTypeIcon entry={row.entry} expanded={row.expanded} t={t} />
                <span className={css.name}>{row.entry.name}</span>
                {letter !== undefined && (
                  <span className={clsx(css.badge, badgeClass(letter))} aria-label={t('editor.tree.git.badge', { letter })}>
                    {letter}
                  </span>
                )}
                {row.loading && (
                  <span className={css.spinner} role="status" aria-label={t('editor.tree.loading')} />
                )}
              </div>
            )
          })}
        </div>
      </div>
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
