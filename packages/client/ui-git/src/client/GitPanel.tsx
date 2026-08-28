/** Git-panel occupant of the details column Git tab. */

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type MouseEvent, type MutableRefObject, type ReactNode, type RefObject,
} from 'react'
import {
  Button, IconChevronDownOutline14, IconChevronRightOutline14, IconCodeOutline16,
  IconDiscardOutline16, IconFolderClose16, IconLoadingOutline16,
  IconPlusOutline16, Menu, Tooltip, useScrollRevealScrollbar, type HighlightSpan,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  GitCommitDiffFile, GitCommitDiffResult, GitDiffLine, GitDiffPreview, GitDiffSide, GitInitResult,
  GitLogEntry, GitLogResult, GitWorkingTreeChange, GitWorkingTreeResult, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { changeKindLetter, commitDiffStatusLetter, splitChangePath } from './change-path-label.ts'
import { isMissingRemoteGitError, isRejectedPushGitError } from './git-error-copy.ts'
import { confirmPopoverPosition } from './git-confirm-popover.ts'
import { fileIconUrlForPath, FILE_ICON_BASE_URL } from './file-icon.ts'
import { buildDiffPreviewRows, type DiffPreviewRow } from './diff-preview-model.ts'
import { DIFF_ROW_ATTR } from './DiffMinimap.tsx'
import type { CharSpan } from './inline-char-diff.ts'
import { DiffMinimap } from './DiffMinimap.tsx'
import { useDiffSyntaxHighlights } from './diff-syntax-highlight.ts'
import { mergeLineHighlight } from './merge-line-highlight.ts'
import { clampOpsWidth, OPS_WIDTH_DEFAULT } from './git-panel-layout.ts'
import { GitSplitHandle } from './GitSplitHandle.tsx'
import { GitGraphSection } from './GitGraphSection.tsx'
import type { createGitPanelStore } from './stores.ts'
import css from './GitPanel.module.css'

const ICON_TOOLTIP_DELAY_MS = 500
const ROW_ACTION_ICON_SIZE = 12
const ACTION_ICON_SIZE = 12
const TOOLBAR_FEEDBACK_DISMISS_MS = 4000
/** Commits fetched per Graph page; matches Host `GIT_LOG_DEFAULT_LIMIT`. */
export const GIT_GRAPH_PAGE_SIZE = 50

type ToolbarAction = 'commit' | 'commitPush' | 'push' | 'removeRemote'

type ConfirmAction = ToolbarAction

type ToolbarFeedback =
  | { kind: 'success'; action: ToolbarAction }
  | { kind: 'error'; action: ToolbarAction; message: string }

/** Host Git callbacks closed over `ctx.workspaces` in apply. */
export interface GitPanelInjected {
  /**
   * Discover the Git repository and list unstaged and staged disk changes.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts a superseded read.
   * @returns the Host working-tree discriminant and lists.
   */
  gitWorkingTree: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<GitWorkingTreeResult>
  /**
   * Initialize a Git repository at the bound Workspace root.
   * @param workspaceId - Workspace whose root receives `git init`.
   * @param signal - aborts a superseded init.
   * @returns the new repository root after a successful init.
   */
  gitInit: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<GitInitResult>
  /**
   * Read a disk-only diff preview for one working-tree change.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param side - unstaged vs staged list that owns the selected row.
   * @param signal - aborts a superseded preview.
   * @returns hunks, whole-file text, a binary marker, or deleted content.
   */
  gitDiffPreview: (
    workspaceId: WorkspaceId,
    path: string,
    side: GitDiffSide,
    signal?: AbortSignal,
  ) => Promise<GitDiffPreview>
  /**
   * Stage one unstaged path (whole file, or one tracked-text hunk when `hunkHeader` is set).
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @returns the refreshed working tree.
   */
  gitStage: (
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
  ) => Promise<GitWorkingTreeResult>
  /**
   * Unstage one staged path (whole file, or one tracked-text hunk when `hunkHeader` is set)
   * without rewriting disk.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @returns the refreshed working tree.
   */
  gitUnstage: (
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
  ) => Promise<GitWorkingTreeResult>
  /**
   * Discard one unstaged path (whole file, or one tracked-text hunk when `hunkHeader` is set)
   * after the panel confirms.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @returns the refreshed working tree.
   */
  gitDiscard: (
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
  ) => Promise<GitWorkingTreeResult>
  /**
   * Create one new HEAD commit from the current index.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param message - commit message; blank after trim is rejected in the panel before Host.
   * @param push - when true, push after commit.
   * @returns the refreshed working tree.
   */
  gitCommit: (workspaceId: WorkspaceId, message: string, push?: boolean) => Promise<GitWorkingTreeResult>
  /**
   * Push the current branch without creating a new commit.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts a superseded push.
   * @returns the refreshed working tree.
   */
  gitPush: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<GitWorkingTreeResult>
  /**
   * Add `origin` with the given URL.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param url - remote URL passed to Host.
   * @returns the refreshed working tree.
   */
  gitAddRemote: (workspaceId: WorkspaceId, url: string) => Promise<GitWorkingTreeResult>
  /**
   * Remove remote `origin`.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts a superseded remove.
   * @returns the refreshed working tree.
   */
  gitRemoveRemote: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<GitWorkingTreeResult>
  /**
   * Read one page of commit history for the discovered repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param query - optional page size and skip from the newest end of history.
   * @param signal - aborts a superseded read.
   * @returns commit rows or availability discriminants.
   */
  gitLog: (
    workspaceId: WorkspaceId,
    query?: { limit?: number; skip?: number },
    signal?: AbortSignal,
  ) => Promise<GitLogResult>
  /**
   * Read first-parent file diffs for one Graph commit.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param hash - abbreviated or full commit hash from gitLog.
   * @param signal - aborts a superseded read.
   * @returns changed files or availability discriminants.
   */
  gitCommitDiff: (
    workspaceId: WorkspaceId,
    hash: string,
    signal?: AbortSignal,
  ) => Promise<GitCommitDiffResult>
}

/** Full Git-panel props: runtime share, locale, store, visibility, and Host Git callbacks. */
export type GitPanelProps =
  PropsRuntime<'conversation.details.git'>
  & PropsLocale<'gitPanel'>
  & PropsStore<ReturnType<typeof createGitPanelStore>>
  & GitPanelInjected

type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; tree: GitWorkingTreeResult }
  | { kind: 'refreshing'; tree: GitWorkingTreeResult }
  | { kind: 'error'; message: string }

type SectionId = GitDiffSide

interface Selection {
  side: SectionId
  row: GitWorkingTreeChange
}

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; side: SectionId; path: string; preview: GitDiffPreview }
  | { kind: 'error'; message: string }

type LogViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; commits: readonly GitLogEntry[]; hasMore: boolean; loadingMore: boolean }
  | { kind: 'error'; message: string }

type CommitDiffView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: Extract<GitCommitDiffResult, { availability: 'repository' }> }
  | { kind: 'error'; message: string }

interface DiscardTarget {
  row: GitWorkingTreeChange
  hunkHeader?: string
}

const COMMIT_INPUT_MAX_HEIGHT_PX = 120

/** Single-line commit field that grows with content up to a scroll cap. */
function CommitMessageInput({ className, placeholder, ariaLabel, value, hint, invalid, pending, onChange }: {
  className: string
  placeholder: string
  ariaLabel: string
  value: string
  hint?: string | undefined
  invalid?: boolean | undefined
  pending?: boolean | undefined
  onChange: (value: string) => void
}): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, COMMIT_INPUT_MAX_HEIGHT_PX)}px`
  }, [value])
  const inputClass = invalid === true ? `${className} ${css.commitInputInvalid}` : className
  return (
    <div className={css.commitField}>
      <div className={css.commitInputShell} data-pending={pending ? true : undefined}>
        <textarea
          ref={ref}
          className={inputClass}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={invalid === true || undefined}
          aria-busy={pending === true || undefined}
          aria-describedby={hint === undefined ? undefined : 'git-commit-message-hint'}
          rows={1}
          value={value}
          disabled={pending === true}
          onChange={(event) => { onChange(event.target.value) }}
        />
      </div>
      {hint !== undefined && (
        <p id="git-commit-message-hint" className={css.commitHint} role="status">
          {hint}
        </p>
      )}
    </div>
  )
}

function toolbarFeedbackLabel(
  t: GitPanelProps['t'],
  feedback: Extract<ToolbarFeedback, { kind: 'success' }>,
): string {
  switch (feedback.action) {
    case 'commitPush':
      return t('git.feedback.commitPushOk')
    case 'push':
      return t('git.feedback.pushOk')
    case 'removeRemote':
      return t('git.feedback.remoteRemoved')
    case 'commit':
      return t('git.feedback.commitOk')
  }
}

function ToolbarFeedbackView({
  feedback, t, onRetryCommit, onAddRemote,
}: {
  feedback: ToolbarFeedback
  t: GitPanelProps['t']
  onRetryCommit?: (() => void) | undefined
  onAddRemote?: (() => void) | undefined
}): ReactNode {
  if (feedback.kind === 'success') {
    return (
      <span className={css.toolbarFeedbackOk} role="status">
        {toolbarFeedbackLabel(t, feedback)}
      </span>
    )
  }
  const missingRemote = feedback.message === t('git.feedback.noRemote')
  return (
    <span className={css.toolbarFeedbackErr} role="alert">
      <span className={css.toolbarFeedbackMessage} title={feedback.message}>{feedback.message}</span>
      {missingRemote && onAddRemote !== undefined && (
        <button type="button" className={css.toolbarFeedbackRetry} onClick={onAddRemote}>
          {t('git.remote.add')}
        </button>
      )}
      {(feedback.action === 'commit' || feedback.action === 'commitPush')
        && onRetryCommit !== undefined && !missingRemote && (
        <button type="button" className={css.toolbarFeedbackRetry} onClick={onRetryCommit}>
          {t('git.commit.retry')}
        </button>
      )}
    </span>
  )
}

function AddRemoteRow({
  t, editorOpen, url, hint, pending, error, onOpen, onChange, onCancel, onSubmit,
}: {
  t: GitPanelProps['t']
  editorOpen: boolean
  url: string
  hint: boolean
  pending: boolean
  error: string | null
  onOpen: () => void
  onChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
}): ReactNode {
  if (!editorOpen) {
    return (
      <div className={css.pushRow} data-git-add-remote-row="true">
        <span className={css.remoteCopy}>{t('git.feedback.noRemote')}</span>
        <button
          type="button"
          className={css.pushButton}
          aria-label={t('git.remote.add')}
          onClick={onOpen}
        >
          {t('git.remote.add')}
        </button>
      </div>
    )
  }
  return (
    <div className={css.remoteEditor} data-git-add-remote-row="true">
      <input
        className={hint ? `${css.remoteUrlInput} ${css.remoteUrlInvalid}` : css.remoteUrlInput}
        value={url}
        placeholder={t('git.remote.urlPlaceholder')}
        aria-label={t('git.remote.urlPlaceholder')}
        aria-invalid={hint || undefined}
        disabled={pending}
        onChange={(event) => { onChange(event.target.value) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
      <button
        type="button"
        className={css.pushButton}
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={onSubmit}
      >
        {t('git.remote.submit')}
      </button>
      <button type="button" className={css.remoteCancel} disabled={pending} onClick={onCancel}>
        {t('git.confirm.cancel')}
      </button>
      {hint && <div className={css.commitHint}>{t('git.remote.urlRequired')}</div>}
      {error !== null && <div className={css.listWriteError} role="alert">{error}</div>}
    </div>
  )
}

function OriginRemoteRow({
  t, url, pending, disabled, feedback, onAskRemove,
}: {
  t: GitPanelProps['t']
  url: string | undefined
  pending: boolean
  disabled: boolean
  feedback: ToolbarFeedback | null
  onAskRemove: (anchor: HTMLElement) => void
}): ReactNode {
  return (
    <div className={css.pushRow} data-git-origin-row="true">
      {url !== undefined && <span className={css.remoteUrl} title={url}>{url}</span>}
      {url !== undefined && (
        <div className={css.pushButtonShell} data-pending={pending ? true : undefined}>
          <button
            type="button"
            className={css.pushButton}
            disabled={disabled}
            aria-busy={pending || undefined}
            aria-label={t('git.remote.remove')}
            onClick={(event) => { onAskRemove(event.currentTarget) }}
          >
            {t('git.remote.remove')}
          </button>
        </div>
      )}
      {feedback !== null && <ToolbarFeedbackView feedback={feedback} t={t} />}
    </div>
  )
}

/** Primary commit action with a chevron menu for commit-only vs commit-and-push. */
function CommitSplitButton({ t, disabled, onAskCommit }: {
  t: GitPanelProps['t']
  disabled: boolean
  onAskCommit: (push: boolean, anchor: HTMLElement) => void
}): ReactNode {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const submitLabel = t('git.commit.submit')
  return (
    <div className={css.commitActions}>
      <button
        type="button"
        className={css.commitPrimary}
        disabled={disabled}
        aria-label={submitLabel}
        onClick={(event) => { onAskCommit(false, event.currentTarget) }}
      >
        {submitLabel}
      </button>
      <Menu
        open={menuOpen}
        onClose={() => { setMenuOpen(false) }}
        align="end"
        compact
        portal
        items={[
          { id: 'commit', label: t('git.commit.submit') },
          { id: 'push', label: t('git.commit.push') },
        ]}
        onSelect={(id) => {
          setMenuOpen(false)
          if (disabled) return
          const anchor = menuTriggerRef.current
          /* v8 ignore next -- the chevron is mounted while the menu is open. */
          if (anchor === null) return
          onAskCommit(id === 'push', anchor)
        }}
        anchor={(
          <button
            ref={menuTriggerRef}
            type="button"
            className={css.commitMenuTrigger}
            disabled={disabled}
            aria-label={t('git.commit.menu')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen(open => !open) }}
          >
            <IconChevronDownOutline14 className={css.commitMenuChevron} />
          </button>
        )}
      />
    </div>
  )
}

/**
 * Git panel body: collapsible Changes (branch, commit, two lists) and Graph, plus in-panel diff preview.
 * @param props - root runtime share, locale, draft store, visibility, and Host Git callbacks.
 * @returns the Git panel surface.
 */
export function GitPanel({
  t, visible, dirtyPaths, notifyDiskPathsChanged, useSessions, useWorkspaces, useStore, actions,
  gitWorkingTree, gitInit, gitDiffPreview, gitStage, gitUnstage, gitDiscard, gitCommit, gitPush,
  gitAddRemote, gitRemoveRemote, gitLog, gitCommitDiff,
}: GitPanelProps) {
  const currentSessionId = useSessions(state => state.current)
  const workspace = useWorkspaces(state =>
    state.items.find(item => currentSessionId !== undefined && item.sessionIds.includes(currentSessionId)),
  )
  const workspaceId = workspace?.workspaceId
  const message = useStore(state => (
    currentSessionId === undefined ? '' : (state.drafts[currentSessionId] ?? '')
  ))
  const [view, setView] = useState<ViewState>({ kind: 'idle' })
  const [reloadEpoch, setReloadEpoch] = useState(0)
  const [previewEpoch, setPreviewEpoch] = useState(0)
  const [initError, setInitError] = useState<string | null>(null)
  const [initPending, setInitPending] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [commitMessageHint, setCommitMessageHint] = useState(false)
  const [toolbarFeedback, setToolbarFeedback] = useState<ToolbarFeedback | null>(null)
  const lastCommitPushRef = useRef(false)
  const toolbarFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [busyKind, setBusyKind] = useState<'stage' | 'unstage' | 'discard' | null>(null)
  const [commitPending, setCommitPending] = useState<'commit' | 'push' | false>(false)
  const [pushPending, setPushPending] = useState(false)
  const [removeRemotePending, setRemoveRemotePending] = useState(false)
  const [remoteEditorOpen, setRemoteEditorOpen] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteHint, setRemoteHint] = useState(false)
  const [remotePending, setRemotePending] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [addRemoteForced, setAddRemoteForced] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(null)
  const [guardTarget, setGuardTarget] = useState<GitWorkingTreeChange | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [confirmAnchor, setConfirmAnchor] = useState<HTMLElement | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' })
  const [logView, setLogView] = useState<LogViewState>({ kind: 'idle' })
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null)
  const [commitDiff, setCommitDiff] = useState<CommitDiffView>({ kind: 'idle' })
  const [opsWidthPx, setOpsWidthPx] = useState<number | null>(null)
  const [opsDragging, setOpsDragging] = useState(false)
  const splitRef = useRef<HTMLDivElement>(null)
  const logViewRef = useRef(logView)
  logViewRef.current = logView
  const loadingMoreLockRef = useRef(false)
  const opsDragBase = useRef(0)

  const beginOpsResize = useCallback(() => {
    const root = splitRef.current
    if (root === null) return
    const pane = root.querySelector('[data-git-ops-pane="true"]')
    const width = pane instanceof HTMLElement
      ? pane.getBoundingClientRect().width
      : opsWidthPx ?? 0
    opsDragBase.current = width
    if (opsWidthPx === null) setOpsWidthPx(width)
    setOpsDragging(true)
  }, [opsWidthPx])

  const dragOpsResize = useCallback((dx: number) => {
    const root = splitRef.current
    if (root === null) return
    const container = root.getBoundingClientRect().width
    setOpsWidthPx(clampOpsWidth(opsDragBase.current + dx, container))
  }, [])

  const endOpsResize = useCallback(() => {
    setOpsDragging(false)
  }, [])

  const clearToolbarFeedbackTimer = useCallback(() => {
    if (toolbarFeedbackTimerRef.current !== null) {
      clearTimeout(toolbarFeedbackTimerRef.current)
      toolbarFeedbackTimerRef.current = null
    }
  }, [])

  const showToolbarFeedback = useCallback((feedback: ToolbarFeedback) => {
    clearToolbarFeedbackTimer()
    setToolbarFeedback(feedback)
    if (feedback.kind === 'success') {
      toolbarFeedbackTimerRef.current = setTimeout(() => {
        setToolbarFeedback(current => (current === feedback ? null : current))
        toolbarFeedbackTimerRef.current = null
      }, TOOLBAR_FEEDBACK_DISMISS_MS)
    }
  }, [clearToolbarFeedbackTimer])

  useEffect(() => () => { clearToolbarFeedbackTimer() }, [clearToolbarFeedbackTimer])

  useEffect(() => {
    setRemoteEditorOpen(false)
    setRemoteUrl('')
    setRemoteHint(false)
    setRemotePending(false)
    setRemoteError(null)
    setAddRemoteForced(false)
    setSelectedCommitHash(null)
    setSelection(null)
    setLogView({ kind: 'idle' })
    setPreview({ kind: 'idle' })
    setCommitDiff({ kind: 'idle' })
  }, [workspaceId])

  useEffect(() => {
    if (!visible || workspaceId === undefined) return
    const ac = new AbortController()
    setView((current) => {
      if (
        (current.kind === 'ready' || current.kind === 'refreshing')
        && current.tree.availability === 'repository'
      ) {
        return { kind: 'refreshing', tree: current.tree }
      }
      return { kind: 'loading' }
    })
    void gitWorkingTree(workspaceId, ac.signal).then((tree) => {
      if (ac.signal.aborted) return
      setInitError(null)
      setWriteError(null)
      setView({ kind: 'ready', tree })
      setSelection(current => retainSelection(current, tree))
      setPreviewEpoch(epoch => epoch + 1)
    }).catch((error: unknown) => {
      if (isAbortError(error) || ac.signal.aborted) return
      setView({ kind: 'error', message: hostErrorMessage(error) })
    })
    return () => { ac.abort() }
  }, [visible, workspaceId, gitWorkingTree, reloadEpoch])

  useEffect(() => {
    if (!visible || workspaceId === undefined) return
    const tree = view.kind === 'ready' || view.kind === 'refreshing' ? view.tree : null
    if (tree?.availability !== 'repository') {
      setLogView({ kind: 'idle' })
      setSelectedCommitHash(null)
      return
    }
    const ac = new AbortController()
    loadingMoreLockRef.current = false
    setLogView(current => current.kind === 'ready' ? current : { kind: 'loading' })
    void gitLog(workspaceId, { limit: GIT_GRAPH_PAGE_SIZE }, ac.signal).then((log) => {
      if (ac.signal.aborted) return
      if (log.availability !== 'repository') {
        setLogView({ kind: 'idle' })
        return
      }
      setLogView({
        kind: 'ready',
        commits: log.commits,
        hasMore: log.hasMore,
        loadingMore: false,
      })
    }).catch((error: unknown) => {
      if (isAbortError(error) || ac.signal.aborted) return
      setLogView({ kind: 'error', message: hostErrorMessage(error) })
    })
    return () => { ac.abort() }
  }, [visible, workspaceId, gitLog, reloadEpoch, view])

  const onLoadMore = useCallback(() => {
    if (loadingMoreLockRef.current) return
    const current = logViewRef.current
    if (current.kind !== 'ready' || !current.hasMore || current.loadingMore) return
    loadingMoreLockRef.current = true
    setLogView({ ...current, loadingMore: true })
  }, [])

  useEffect(() => {
    if (logView.kind !== 'ready' || !logView.loadingMore) return
    if (!visible || workspaceId === undefined) {
      loadingMoreLockRef.current = false
      return
    }
    const ac = new AbortController()
    const skip = logView.commits.length
    const prior = logView.commits
    void gitLog(workspaceId, { limit: GIT_GRAPH_PAGE_SIZE, skip }, ac.signal).then((log) => {
      if (ac.signal.aborted) return
      loadingMoreLockRef.current = false
      if (log.availability !== 'repository') {
        setLogView({ kind: 'ready', commits: prior, hasMore: false, loadingMore: false })
        return
      }
      const seen = new Set(prior.map(entry => entry.hash))
      const commits = [...prior]
      for (const entry of log.commits) {
        if (!seen.has(entry.hash)) commits.push(entry)
      }
      setLogView({
        kind: 'ready',
        commits,
        hasMore: log.hasMore && commits.length > prior.length,
        loadingMore: false,
      })
    }).catch((error: unknown) => {
      if (isAbortError(error) || ac.signal.aborted) return
      loadingMoreLockRef.current = false
      setLogView({ kind: 'ready', commits: prior, hasMore: true, loadingMore: false })
    })
    return () => {
      ac.abort()
      loadingMoreLockRef.current = false
    }
  }, [logView, visible, workspaceId, gitLog])

  useEffect(() => {
    if (selection === null) {
      setPreview({ kind: 'idle' })
      return
    }
    if (!visible || workspaceId === undefined) return
    const ac = new AbortController()
    const selected = selection
    setPreview(current => (
      current.kind === 'ready'
        && current.side === selected.side
        && current.path === selected.row.absolutePath
        ? current
        : { kind: 'loading' }
    ))
    void gitDiffPreview(workspaceId, selected.row.absolutePath, selected.side, ac.signal).then((value) => {
      if (ac.signal.aborted) return
      setPreview({ kind: 'ready', side: selected.side, path: selected.row.absolutePath, preview: value })
    }).catch((error: unknown) => {
      if (isAbortError(error) || ac.signal.aborted) return
      setPreview({ kind: 'error', message: hostErrorMessage(error) })
    })
    return () => { ac.abort() }
  }, [visible, workspaceId, selection, gitDiffPreview, previewEpoch])

  useEffect(() => {
    if (selectedCommitHash === null) {
      setCommitDiff({ kind: 'idle' })
      return
    }
    if (!visible || workspaceId === undefined) return
    const ac = new AbortController()
    const hash = selectedCommitHash
    setCommitDiff(current => (
      current.kind === 'ready' && current.result.hash === hash ? current : { kind: 'loading' }
    ))
    void gitCommitDiff(workspaceId, hash, ac.signal).then((value) => {
      if (ac.signal.aborted) return
      if (value.availability !== 'repository') {
        setCommitDiff({
          kind: 'error',
          message: value.availability === 'git-unavailable'
            ? t('git.empty.unavailable.title')
            : t('git.empty.notRepo.title'),
        })
        return
      }
      setCommitDiff({ kind: 'ready', result: value })
    }).catch((error: unknown) => {
      if (isAbortError(error) || ac.signal.aborted) return
      setCommitDiff({ kind: 'error', message: hostErrorMessage(error) })
    })
    return () => { ac.abort() }
  }, [visible, workspaceId, selectedCommitHash, gitCommitDiff, t])

  const pathWriting = busyPath !== null
  const isDirty = (path: string): boolean => dirtyPaths.includes(path)

  const openGuard = (row: GitWorkingTreeChange): boolean => {
    if (!isDirty(row.absolutePath)) return false
    setGuardTarget(row)
    return true
  }

  const applyTree = (tree: GitWorkingTreeResult): void => {
    setWriteError(null)
    setView({ kind: 'ready', tree })
    setSelection(current => retainSelection(current, tree))
    setPreviewEpoch(epoch => epoch + 1)
  }

  const runPathWrite = async (
    path: string,
    kind: 'stage' | 'unstage' | 'discard',
    write: () => Promise<GitWorkingTreeResult>,
  ): Promise<boolean> => {
    /* v8 ignore next -- row actions only render after a Workspace-bound repository read. */
    if (workspaceId === undefined || pathWriting) return false
    setBusyPath(path)
    setBusyKind(kind)
    setWriteError(null)
    if (kind === 'discard') notifyDiskPathsChanged([path], false)
    try {
      applyTree(await write())
      if (kind === 'discard') notifyDiskPathsChanged([path], true)
      return true
    } catch (error: unknown) {
      if (kind === 'discard') notifyDiskPathsChanged([path], true)
      setWriteError(hostErrorMessage(error))
      return false
    } finally {
      setBusyPath(null)
      setBusyKind(null)
    }
  }

  const runSection = async (
    rows: readonly GitWorkingTreeChange[],
    kind: 'stage' | 'unstage',
    write: (path: string) => Promise<GitWorkingTreeResult>,
  ): Promise<void> => {
    for (const row of rows) {
      const ok = await runPathWrite(row.absolutePath, kind, () => write(row.absolutePath))
      if (!ok) return
    }
  }

  const onInit = (): void => {
    /* v8 ignore next -- Init CTA only renders after a Workspace-bound not-a-repository read. */
    if (workspaceId === undefined) return
    setInitPending(true)
    setInitError(null)
    void gitInit(workspaceId).then(() => {
      setInitPending(false)
      setReloadEpoch(epoch => epoch + 1)
    }).catch((error: unknown) => {
      setInitPending(false)
      setInitError(hostErrorMessage(error))
    })
  }

  const onAskCommit = (push: boolean, anchor: HTMLElement): void => {
    /* v8 ignore next -- Submit is disabled until a Session-bound repository has staged files. */
    if (workspaceId === undefined || currentSessionId === undefined || commitPending) return
    const trimmed = message.trim()
    if (trimmed === '') {
      setCommitMessageHint(true)
      setWriteError(null)
      return
    }
    setCommitMessageHint(false)
    setConfirmAnchor(anchor)
    setConfirmAction(push === true ? 'commitPush' : 'commit')
  }

  const onAskPush = (anchor: HTMLElement): void => {
    /* v8 ignore next -- Push only renders after a Workspace-bound repository read. */
    if (workspaceId === undefined || pushPending || commitPending) return
    setConfirmAnchor(anchor)
    setConfirmAction('push')
  }

  const onCancelConfirm = (): void => {
    setConfirmAction(null)
    setConfirmAnchor(null)
  }

  const onConfirmAction = (): void => {
    if (confirmAction === null) return
    const action = confirmAction
    setConfirmAction(null)
    setConfirmAnchor(null)
    if (action === 'push') onPush()
    else if (action === 'removeRemote') onRemoveRemote()
    else onCommit(action === 'commitPush')
  }

  const onCommit = (push = false): void => {
    /* v8 ignore next -- Submit is disabled until a Session-bound repository has staged files. */
    if (workspaceId === undefined || currentSessionId === undefined || commitPending) return
    const trimmed = message.trim()
    if (trimmed === '') {
      setCommitMessageHint(true)
      setWriteError(null)
      return
    }
    setCommitMessageHint(false)
    clearToolbarFeedbackTimer()
    setToolbarFeedback(null)
    const action: ToolbarAction = push === true ? 'commitPush' : 'commit'
    setCommitPending(push === true ? 'push' : 'commit')
    setWriteError(null)
    lastCommitPushRef.current = push === true
    void gitCommit(workspaceId, trimmed, push === true ? true : undefined).then((tree) => {
      setCommitPending(false)
      applyTree(tree)
      actions.clearDraft(currentSessionId)
      showToolbarFeedback({ kind: 'success', action })
    }).catch((error: unknown) => {
      setCommitPending(false)
      showToolbarFeedback({ kind: 'error', action, message: toolbarGitErrorMessage(t, error) })
    })
  }

  const onPush = (): void => {
    /* v8 ignore next -- Push only renders after a Workspace-bound repository read. */
    if (workspaceId === undefined || pushPending || commitPending) return
    clearToolbarFeedbackTimer()
    setToolbarFeedback(null)
    setPushPending(true)
    setWriteError(null)
    void gitPush(workspaceId).then((tree) => {
      setPushPending(false)
      applyTree(tree)
      showToolbarFeedback({ kind: 'success', action: 'push' })
    }).catch((error: unknown) => {
      setPushPending(false)
      showToolbarFeedback({ kind: 'error', action: 'push', message: toolbarGitErrorMessage(t, error) })
    })
  }

  const onAskRemoveRemote = (anchor: HTMLElement): void => {
    /* v8 ignore next -- Remove only renders after a Workspace-bound repository read. */
    if (workspaceId === undefined || removeRemotePending || pushPending || commitPending) return
    setConfirmAnchor(anchor)
    setConfirmAction('removeRemote')
  }

  const onRemoveRemote = (): void => {
    /* v8 ignore next -- Remove only renders after a Workspace-bound repository read. */
    if (workspaceId === undefined || removeRemotePending || pushPending || commitPending) return
    clearToolbarFeedbackTimer()
    setToolbarFeedback(null)
    setRemoveRemotePending(true)
    setWriteError(null)
    void gitRemoveRemote(workspaceId).then((tree) => {
      setRemoveRemotePending(false)
      applyTree(tree)
      showToolbarFeedback({ kind: 'success', action: 'removeRemote' })
    }).catch((error: unknown) => {
      setRemoveRemotePending(false)
      showToolbarFeedback({
        kind: 'error',
        action: 'removeRemote',
        message: toolbarGitErrorMessage(t, error),
      })
    })
  }

  const onOpenRemoteEditor = (): void => {
    setAddRemoteForced(true)
    setRemoteEditorOpen(true)
    setRemoteHint(false)
    setRemoteError(null)
  }

  const onSubmitRemote = (): void => {
    if (workspaceId === undefined || remotePending) return
    const trimmed = remoteUrl.trim()
    if (trimmed === '') {
      setRemoteHint(true)
      setRemoteError(null)
      return
    }
    setRemoteHint(false)
    setRemotePending(true)
    setRemoteError(null)
    void gitAddRemote(workspaceId, trimmed).then((tree) => {
      setRemotePending(false)
      setRemoteEditorOpen(false)
      setAddRemoteForced(false)
      setRemoteUrl('')
      applyTree(tree)
    }).catch((error: unknown) => {
      setRemotePending(false)
      const raw = hostErrorMessage(error)
      setRemoteError(raw === 'empty remote url' ? t('git.remote.urlRequired') : toolbarGitErrorMessage(t, error))
    })
  }

  return (
    <div className={css.root} data-surface="git-panel">
      {renderBody({
        view, logView, selectedCommitHash, commitDiff, t, onInit, initError, initPending, writeError,
        commitMessageHint, toolbarFeedback, message, busyPath, busyKind,
        commitPending, pushPending, removeRemotePending, discardTarget, guardTarget,
        confirmAction, confirmAnchor, pathWriting, dirtyPaths, selection, preview,
        remoteEditorOpen, remoteUrl, remoteHint, remotePending, remoteError, addRemoteForced,
        splitRef, opsWidthPx, opsDragging, beginOpsResize, dragOpsResize, endOpsResize,
        onMessage: (value) => {
          /* v8 ignore next -- the commit field only renders for a current Session. */
          if (currentSessionId === undefined) return
          setCommitMessageHint(false)
          clearToolbarFeedbackTimer()
          setToolbarFeedback(current => (
            current?.action === 'commit' || current?.action === 'commitPush' ? null : current
          ))
          actions.setDraft(currentSessionId, value)
        },
        onSelect: (side, row) => {
          setSelectedCommitHash(null)
          setSelection((current) => {
            if (current?.side === side && current.row.absolutePath === row.absolutePath) return current
            return { side, row }
          })
        },
        onStage: (row, hunkHeader) => {
          /* v8 ignore next -- row actions only render after a Workspace-bound repository read. */
          if (workspaceId === undefined) return
          if (openGuard(row)) return
          void runPathWrite(
            row.absolutePath,
            'stage',
            () => invokeWrite(gitStage, workspaceId, row.absolutePath, hunkHeader),
          )
        },
        onUnstage: (row, hunkHeader) => {
          /* v8 ignore next -- row actions only render after a Workspace-bound repository read. */
          if (workspaceId === undefined) return
          void runPathWrite(
            row.absolutePath,
            'unstage',
            () => invokeWrite(gitUnstage, workspaceId, row.absolutePath, hunkHeader),
          )
        },
        onStageAll: (rows) => {
          /* v8 ignore next -- section actions only render after a Workspace-bound repository read. */
          if (workspaceId === undefined) return
          const blocked = rows.find(row => isDirty(row.absolutePath))
          if (blocked !== undefined) {
            setGuardTarget(blocked)
            return
          }
          void runSection(rows, 'stage', path => gitStage(workspaceId, path))
        },
        onUnstageAll: (rows) => {
          /* v8 ignore next -- section actions only render after a Workspace-bound repository read. */
          if (workspaceId === undefined) return
          void runSection(rows, 'unstage', path => gitUnstage(workspaceId, path))
        },
        onAskDiscard: (row, hunkHeader) => {
          if (openGuard(row)) return
          setDiscardTarget(hunkHeader === undefined ? { row } : { row, hunkHeader })
        },
        onCancelDiscard: () => { setDiscardTarget(null) },
        onConfirmDiscard: () => {
          const target = discardTarget
          /* v8 ignore next -- confirm only renders while a discard target is set on a bound Workspace. */
          if (target === null || workspaceId === undefined) return
          setDiscardTarget(null)
          void runPathWrite(
            target.row.absolutePath,
            'discard',
            () => invokeWrite(gitDiscard, workspaceId, target.row.absolutePath, target.hunkHeader),
          )
        },
        onCancelGuard: () => { setGuardTarget(null) },
        onAskCommit, onAskPush, onAskRemoveRemote, onCancelConfirm, onConfirmAction,
        onCommit, onPush, onRetryCommit: () => { onCommit(lastCommitPushRef.current) },
        onOpenRemoteEditor, onSubmitRemote,
        onRemoteUrl: (value) => {
          setRemoteUrl(value)
          setRemoteHint(false)
          setRemoteError(null)
        },
        onCancelRemote: () => {
          setRemoteEditorOpen(false)
          setAddRemoteForced(false)
          setRemoteUrl('')
          setRemoteHint(false)
          setRemoteError(null)
        },
        onSelectCommit: (hash) => {
          setSelection(null)
          setSelectedCommitHash(hash)
        },
        onLoadMore,
      })}
    </div>
  )
}

interface RepoBody {
  view: ViewState
  logView: LogViewState
  selectedCommitHash: string | null
  commitDiff: CommitDiffView
  t: GitPanelProps['t']
  onInit: () => void
  initError: string | null
  initPending: boolean
  writeError: string | null
  commitMessageHint: boolean
  toolbarFeedback: ToolbarFeedback | null
  message: string
  busyPath: string | null
  busyKind: 'stage' | 'unstage' | 'discard' | null
  commitPending: 'commit' | 'push' | false
  pushPending: boolean
  removeRemotePending: boolean
  remoteEditorOpen: boolean
  remoteUrl: string
  remoteHint: boolean
  remotePending: boolean
  remoteError: string | null
  addRemoteForced: boolean
  discardTarget: DiscardTarget | null
  guardTarget: GitWorkingTreeChange | null
  confirmAction: ConfirmAction | null
  confirmAnchor: HTMLElement | null
  pathWriting: boolean
  dirtyPaths: readonly string[]
  selection: Selection | null
  preview: PreviewState
  splitRef: RefObject<HTMLDivElement>
  opsWidthPx: number | null
  opsDragging: boolean
  beginOpsResize: () => void
  dragOpsResize: (dx: number) => void
  endOpsResize: () => void
  onMessage: (value: string) => void
  onSelect: (side: SectionId, row: GitWorkingTreeChange) => void
  onStage: (row: GitWorkingTreeChange, hunkHeader?: string) => void
  onUnstage: (row: GitWorkingTreeChange, hunkHeader?: string) => void
  onStageAll: (rows: readonly GitWorkingTreeChange[]) => void
  onUnstageAll: (rows: readonly GitWorkingTreeChange[]) => void
  onAskDiscard: (row: GitWorkingTreeChange, hunkHeader?: string) => void
  onCancelDiscard: () => void
  onConfirmDiscard: () => void
  onCancelGuard: () => void
  onAskCommit: (push: boolean, anchor: HTMLElement) => void
  onAskPush: (anchor: HTMLElement) => void
  onAskRemoveRemote: (anchor: HTMLElement) => void
  onCancelConfirm: () => void
  onConfirmAction: () => void
  onCommit: (push?: boolean) => void
  onPush: () => void
  onRetryCommit: () => void
  onOpenRemoteEditor: () => void
  onSubmitRemote: () => void
  onRemoteUrl: (value: string) => void
  onCancelRemote: () => void
  onSelectCommit: (hash: string) => void
  onLoadMore: () => void
}

function renderBody(body: RepoBody): ReactNode {
  const { view, t, onInit, initError, initPending } = body
  if (view.kind === 'idle') return null
  if (view.kind === 'loading') {
    return (
      <div className={css.feedback} role="status" aria-label={t('git.loading')} aria-live="polite">
        <span className={css.spinner} aria-hidden="true">
          <IconLoadingOutline16 size={24} />
        </span>
        <span className={css.feedbackCopy}>{t('git.loading')}</span>
      </div>
    )
  }
  if (view.kind === 'error') {
    return (
      <div className={css.overlay}>
        <div className={css.emptyCard} role="alert">
          <span className={css.emptyIcon} aria-hidden="true">
            <IconCodeOutline16 size={48} />
          </span>
          <div className={css.emptyTitle}>{view.message}</div>
        </div>
      </div>
    )
  }
  const tree = view.tree
  if (tree.availability === 'git-unavailable') {
    return (
      <div className={css.overlay}>
        <div className={css.emptyCard}>
          <span className={css.emptyIcon} aria-hidden="true">
            <IconCodeOutline16 size={48} />
          </span>
          <div className={css.emptyTitle}>{t('git.empty.unavailable.title')}</div>
          <div className={css.emptyBody}>{t('git.empty.unavailable.body')}</div>
        </div>
      </div>
    )
  }
  if (tree.availability === 'not-a-repository') {
    return (
      <div className={css.overlay}>
        <div className={css.emptyCard}>
          <span className={css.emptyIcon} aria-hidden="true">
            <IconFolderClose16 size={48} />
          </span>
          <div className={css.emptyTitle}>{t('git.empty.notRepo.title')}</div>
          <div className={css.emptyBody}>{t('git.empty.notRepo.body')}</div>
          <Button variant="primary" size="sm" disabled={initPending} onClick={onInit}>
            {t('git.init')}
          </Button>
          {initError !== null && <div className={css.errorCopy} role="alert">{initError}</div>}
        </div>
      </div>
    )
  }
  return renderRepository(tree, view.kind === 'refreshing', body)
}

function renderRepository(
  tree: Extract<GitWorkingTreeResult, { availability: 'repository' }>,
  refreshing: boolean,
  body: RepoBody,
): ReactNode {
  const {
    t, message, writeError, commitMessageHint, toolbarFeedback,
    commitPending, pushPending, discardTarget, guardTarget, confirmAction, confirmAnchor,
  } = body
  const stagedEmpty = tree.staged.length === 0
  const stagedDirty = tree.staged.some(row => body.dirtyPaths.includes(row.absolutePath))
  const commitDisabled = stagedEmpty || commitPending !== false || stagedDirty
  const pushDisabled = !tree.pushAvailable || pushPending || commitPending !== false
  const pushFeedbackVisible = toolbarFeedback !== null && toolbarFeedback.action === 'push' && !pushPending
  const removeFeedbackVisible = toolbarFeedback !== null
    && toolbarFeedback.action === 'removeRemote'
    && !body.removeRemotePending
  const opsClass = body.opsWidthPx !== null ? `${css.ops} ${css.opsResized}` : css.ops
  return (
    <div
      ref={body.splitRef}
      className={css.split}
      style={{ '--git-ops-default-width': `${OPS_WIDTH_DEFAULT}px` } as CSSProperties}
      data-ops-dragging={body.opsDragging || undefined}
    >
      <div
        className={opsClass}
        style={body.opsWidthPx !== null ? { width: body.opsWidthPx } : undefined}
        data-git-ops-pane="true"
      >
        {refreshing
          ? <div className={css.refreshBar} role="progressbar" aria-label={t('git.refresh')} />
          : <div className={css.refreshSlot} />}
        <div className={css.lists} data-git-lists="">
          <ChangesSection t={t} changeCount={tree.unstaged.length + tree.staged.length}>
            <div className={css.branchRow}>
              <div className={css.branch}>
                {t('git.branch', { name: tree.branch })}
              </div>
              {(tree.hasRemote === false || body.addRemoteForced) && (
                <AddRemoteRow
                  t={t}
                  editorOpen={body.remoteEditorOpen}
                  url={body.remoteUrl}
                  hint={body.remoteHint}
                  pending={body.remotePending}
                  error={body.remoteError}
                  onOpen={body.onOpenRemoteEditor}
                  onChange={body.onRemoteUrl}
                  onCancel={body.onCancelRemote}
                  onSubmit={body.onSubmitRemote}
                />
              )}
              {tree.originUrl !== undefined || removeFeedbackVisible ? (
                <OriginRemoteRow
                  t={t}
                  url={tree.originUrl}
                  pending={body.removeRemotePending}
                  disabled={
                    body.removeRemotePending
                    || pushPending
                    || commitPending !== false
                    || body.remotePending
                  }
                  feedback={removeFeedbackVisible ? toolbarFeedback : null}
                  onAskRemove={body.onAskRemoveRemote}
                />
              ) : null}
              {tree.hasRemote !== false && (tree.pushAvailable || pushFeedbackVisible) && (
                <div className={css.pushRow} data-git-push-row="true">
                  {tree.pushAvailable && (
                    <>
                      <span className={css.branchAhead}>
                        {tree.ahead !== undefined && tree.ahead > 0
                          ? t('git.branch.ahead', { count: tree.ahead })
                          : t('git.branch.unpublished')}
                      </span>
                      <Tooltip
                        label={
                          tree.ahead !== undefined && tree.ahead > 0
                            ? t('git.push.hintAhead', { count: tree.ahead, branch: tree.branch })
                            : t('git.push.hintUnpublished', { branch: tree.branch })
                        }
                        side="bottom"
                        delayMs={ICON_TOOLTIP_DELAY_MS}
                        disabled={pushPending || commitPending !== false}
                      >
                        <div className={css.pushButtonShell} data-pending={pushPending ? true : undefined}>
                          <button
                            type="button"
                            className={css.pushButton}
                            disabled={pushDisabled}
                            aria-busy={pushPending || undefined}
                            aria-label={t('git.push')}
                            onClick={(event) => { body.onAskPush(event.currentTarget) }}
                          >
                            {t('git.push')}
                          </button>
                        </div>
                      </Tooltip>
                    </>
                  )}
                  {pushFeedbackVisible && toolbarFeedback !== null && (
                    <ToolbarFeedbackView
                      feedback={toolbarFeedback}
                      t={t}
                      onAddRemote={body.onOpenRemoteEditor}
                    />
                  )}
                </div>
              )}
            </div>
            <CommitMessageInput
              className={css.commitInput ?? ''}
              placeholder={t('git.commit.placeholder')}
              ariaLabel={t('git.commit.placeholder')}
              value={message}
              invalid={commitMessageHint}
              hint={commitMessageHint ? t('git.commit.required') : undefined}
              pending={commitPending !== false}
              onChange={body.onMessage}
            />
            <div className={css.commitToolbar}>
              <CommitSplitButton
                t={t}
                disabled={commitDisabled}
                onAskCommit={body.onAskCommit}
              />
              {toolbarFeedback !== null
                && (toolbarFeedback.action === 'commit' || toolbarFeedback.action === 'commitPush')
                && commitPending === false && (
                <ToolbarFeedbackView
                  feedback={toolbarFeedback}
                  t={t}
                  onRetryCommit={toolbarFeedback.kind === 'error' ? body.onRetryCommit : undefined}
                  onAddRemote={toolbarFeedback.kind === 'error' ? body.onOpenRemoteEditor : undefined}
                />
              )}
            </div>
            {writeError !== null && (
              <div className={css.listWriteError} role="alert">
                {writeError}
              </div>
            )}
            <div className={css.changesFiles} data-git-changes-files="">
              <ChangeSection
                id="unstaged"
                title={t('git.section.unstaged')}
                rows={tree.unstaged}
                body={body}
              />
              <ChangeSection
                id="staged"
                title={t('git.section.staged')}
                rows={tree.staged}
                body={body}
              />
            </div>
          </ChangesSection>
          <GitGraphSection
            t={t}
            loading={body.logView.kind === 'loading' || (body.logView.kind === 'ready' && body.logView.loadingMore)}
            commits={body.logView.kind === 'ready' ? body.logView.commits : body.logView.kind === 'loading' ? null : []}
            selectedHash={body.selectedCommitHash}
            onSelect={body.onSelectCommit}
            hasMore={body.logView.kind === 'ready' && body.logView.hasMore}
            loadingMore={body.logView.kind === 'ready' && body.logView.loadingMore}
            onLoadMore={body.onLoadMore}
          />
        </div>
      </div>
      <GitSplitHandle
        ariaLabel={t('git.ops.resize')}
        onStart={body.beginOpsResize}
        onDrag={body.dragOpsResize}
        onEnd={body.endOpsResize}
      />
      <DiffPreviewPane body={body} />
      {discardTarget !== null && (
        <DiscardDialog
          target={discardTarget.row}
          t={t}
          onCancel={body.onCancelDiscard}
          onConfirm={body.onConfirmDiscard}
        />
      )}
      {guardTarget !== null && (
        <GuardDialog
          target={guardTarget}
          t={t}
          onCancel={body.onCancelGuard}
        />
      )}
      {confirmAction !== null && confirmAnchor !== null && (
        <ActionConfirmDialog
          action={confirmAction}
          anchor={confirmAnchor}
          branch={tree.branch}
          ahead={tree.ahead}
          originUrl={tree.originUrl}
          t={t}
          onCancel={body.onCancelConfirm}
          onConfirm={body.onConfirmAction}
        />
      )}
    </div>
  )
}

function CommitDiffPane({ body }: { body: RepoBody }): ReactNode {
  const { t, commitDiff, selectedCommitHash } = body
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(new Set())
  const { ref: scrollRevealRef, active: scrollActive } = useScrollRevealScrollbar()
  useEffect(() => {
    setExpandedPaths(new Set())
  }, [selectedCommitHash])
  return (
    <div className={css.preview} role="region" aria-label={t('git.preview.region')}>
      {commitDiff.kind === 'idle' || commitDiff.kind === 'loading'
        ? (
          <div className={css.previewFeedback} role="status" aria-label={t('git.loading')}>
            <span className={css.spinner} aria-hidden="true">
              <IconLoadingOutline16 size={24} />
            </span>
          </div>
        )
        : commitDiff.kind === 'error'
          ? <div className={css.previewFeedback} role="alert">{commitDiff.message}</div>
          : commitDiff.result.files.length === 0
            ? <div className={css.previewEmpty}>{t('git.empty.commit')}</div>
            : (
              <div
                className={scrollActive ? `${css.previewBody} ${css.previewBodyActive}` : css.previewBody}
                ref={scrollRevealRef}
              >
                {commitDiff.result.files.map(file => (
                  <CommitDiffFileBlock
                    key={file.path}
                    file={file}
                    expanded={expandedPaths.has(file.path)}
                    onToggle={() => {
                      setExpandedPaths((current) => {
                        const next = new Set(current)
                        if (next.has(file.path)) next.delete(file.path)
                        else next.add(file.path)
                        return next
                      })
                    }}
                    body={body}
                  />
                ))}
                {commitDiff.result.truncated && (
                  <div className={css.previewTruncated} role="note">
                    {t('git.commitDiff.truncated', { count: commitDiff.result.files.length })}
                  </div>
                )}
              </div>
            )}
    </div>
  )
}

function CommitDiffFileBlock({
  file, expanded, onToggle, body,
}: {
  file: GitCommitDiffFile
  expanded: boolean
  onToggle: () => void
  body: RepoBody
}): ReactNode {
  const { t } = body
  const { fileName, parentDir } = splitChangePath(file.path)
  const letter = commitDiffStatusLetter(file.status)
  const statusClass = file.status === 'added'
    ? css.rowBadgeUntracked
    : file.status === 'deleted'
      ? css.rowBadgeDeleted
      : css.rowBadgeModified
  const label = expanded
    ? t('git.commitDiff.collapse', { path: file.path })
    : t('git.commitDiff.expand', { path: file.path })
  return (
    <section className={css.commitFile} data-commit-file={file.path}>
      <button
        type="button"
        className={css.commitFileHead}
        aria-expanded={expanded}
        aria-label={label}
        onClick={onToggle}
      >
        {expanded
          ? <IconChevronDownOutline14 size={14} />
          : <IconChevronRightOutline14 size={14} />}
        <span className={css.rowIcon} role="img" aria-label={t('git.icon.file')}>
          <img
            className={css.rowGlyph}
            src={fileIconUrlForPath(file.path)}
            width={16}
            height={16}
            alt=""
            decoding="async"
            onError={(event) => {
              const img = event.currentTarget
              if (img.src.endsWith(`${FILE_ICON_BASE_URL}/file.svg`)) return
              img.src = `${FILE_ICON_BASE_URL}/file.svg`
            }}
          />
        </span>
        <span className={css.rowLabel}>
          <span className={css.rowFileName}>{fileName}</span>
          {parentDir !== '' && <span className={css.rowParentDir}>{parentDir}</span>}
        </span>
        <span className={[css.rowBadge, statusClass].join(' ')} aria-label={t('git.change.status', { letter })}>
          {letter}
        </span>
      </button>
      {expanded && (
        <div className={css.commitFileBody}>
          <DiffPreviewContent
            preview={file.preview}
            path={file.path}
            selection={null}
            body={body}
          />
        </div>
      )}
    </section>
  )
}

function DiffPreviewPane({ body }: { body: RepoBody }): ReactNode {
  if (body.selectedCommitHash !== null) {
    return <CommitDiffPane body={body} />
  }
  const { t, selection, preview } = body
  const scrollRef = useRef<HTMLDivElement | null>(null) as MutableRefObject<HTMLDivElement | null>
  const { ref: scrollRevealRef, active: scrollActive } = useScrollRevealScrollbar()
  const setPreviewScrollRef = useCallback((element: HTMLDivElement | null) => {
    scrollRef.current = element
    scrollRevealRef(element)
  }, [scrollRef, scrollRevealRef])
  useEffect(() => {
    if (preview.kind !== 'ready') return
    const scrollEl = scrollRef.current
    if (scrollEl !== null && typeof scrollEl.scrollTo === 'function') {
      scrollEl.scrollTo({ top: 0 })
    }
  }, [preview, scrollRef, selection])
  return (
    <div className={css.preview} role="region" aria-label={t('git.preview.region')}>
      {selection === null || preview.kind === 'idle'
        ? <div className={css.previewEmpty}>{t('git.empty.preview')}</div>
        : (
          <>
            <div className={css.previewBar}>
              <span className={css.previewName}>{selection.row.path}</span>
              <WholeFilePreviewActions side={selection.side} row={selection.row} body={body} />
            </div>
            <div className={css.previewScrollWrap}>
              <div
                className={scrollActive ? `${css.previewBody} ${css.previewBodyActive}` : css.previewBody}
                ref={setPreviewScrollRef}
              >
                {preview.kind === 'loading' && (
                  <div className={css.previewFeedback} role="status" aria-label={t('git.loading')}>
                    <span className={css.spinner} aria-hidden="true">
                      <IconLoadingOutline16 size={24} />
                    </span>
                  </div>
                )}
                {preview.kind === 'error' && (
                  <div className={css.previewFeedback} role="alert">{preview.message}</div>
                )}
                {preview.kind === 'ready' && (
                  <DiffPreviewContent
                    preview={preview.preview}
                    path={selection.row.absolutePath}
                    selection={selection}
                    body={body}
                  />
                )}
              </div>
              {preview.kind === 'ready' && (
                <DiffMinimap
                  rows={buildDiffPreviewRows(preview.preview)}
                  scrollRef={scrollRef}
                />
              )}
            </div>
          </>
        )}
    </div>
  )
}

function WholeFilePreviewActions({
  side, row, body,
}: {
  side: SectionId
  row: GitWorkingTreeChange
  body: RepoBody
}): ReactNode {
  const { t } = body
  const guarded = body.dirtyPaths.includes(row.absolutePath)
  if (side === 'unstaged') {
    return (
      <span className={css.rowActions}>
        <IconAction
          label={t('git.stage')}
          inactive={body.pathWriting || guarded}
          suppressTooltip={body.pathWriting}
          onClick={() => { body.onStage(row) }}
        >
          <IconPlusOutline16 size={ROW_ACTION_ICON_SIZE} />
        </IconAction>
        <IconAction
          label={t('git.discard')}
          inactive={body.pathWriting || guarded}
          suppressTooltip={body.pathWriting}
          onClick={() => { body.onAskDiscard(row) }}
        >
          <IconDiscardOutline16 size={ROW_ACTION_ICON_SIZE} />
        </IconAction>
      </span>
    )
  }
  return (
    <span className={css.rowActions}>
      <IconAction
        label={t('git.unstage')}
        inactive={body.pathWriting}
        suppressTooltip={body.pathWriting}
        onClick={() => { body.onUnstage(row) }}
      >
        <IconMinus size={ROW_ACTION_ICON_SIZE} />
      </IconAction>
    </span>
  )
}

function DiffPreviewContent({
  preview, path, selection, body,
}: {
  preview: GitDiffPreview
  path: string
  selection: Selection | null
  body: RepoBody
}): ReactNode {
  const rows = preview.kind === 'binary' || preview.kind === 'deleted-binary'
    ? []
    : buildDiffPreviewRows(preview)
  const syntaxByRow = useDiffSyntaxHighlights(rows, path)
  switch (preview.kind) {
    case 'binary':
    case 'deleted-binary':
      return (
        <div className={css.binaryWrap}>
          <div className={css.emptyCard}>
            <div className={css.emptyTitle}>{body.t('git.preview.binary')}</div>
          </div>
        </div>
      )
    default:
      return rows.map((row, index) => (
        <DiffPreviewRowView
          key={index}
          row={row}
          selection={selection}
          body={body}
          syntaxSpans={syntaxByRow.get(index)}
        />
      ))
  }
}

function DiffPreviewRowView({
  row, selection, body, syntaxSpans,
}: {
  row: DiffPreviewRow
  selection: Selection | null
  body: RepoBody
  syntaxSpans?: readonly HighlightSpan[] | undefined
}): ReactNode {
  if (row.kind === 'truncated') {
    return (
      <div className={css.previewTruncated} role="note" {...{ [DIFF_ROW_ATTR]: '' }}>
        {body.t('git.preview.truncated', { count: row.omitted })}
      </div>
    )
  }
  const gutter = selection !== null && row.hunkLineIndex === 0 && row.hunkHeader !== ''
    ? (
      <HunkGutterActions
        side={selection.side}
        row={selection.row}
        hunkHeader={row.hunkHeader}
        body={body}
      />
    )
    : undefined
  return (
    <DiffLineRow
      lineNum={row.lineNum}
      origin={row.origin}
      text={row.text}
      charSpans={row.charSpans}
      syntaxSpans={syntaxSpans}
      gutterActions={gutter}
    />
  )
}

function HunkGutterActions({
  side, row, hunkHeader, body,
}: {
  side: SectionId
  row: GitWorkingTreeChange
  hunkHeader: string
  body: RepoBody
}): ReactNode {
  const { t } = body
  const guarded = body.dirtyPaths.includes(row.absolutePath)
  if (side === 'unstaged') {
    return (
      <>
        <IconAction
          label={t('git.stage')}
          inactive={body.pathWriting || guarded}
          suppressTooltip={body.pathWriting}
          onClick={() => { body.onStage(row, hunkHeader) }}
        >
          <IconPlusOutline16 size={ACTION_ICON_SIZE} />
        </IconAction>
        <IconAction
          label={t('git.hunk.discard')}
          inactive={body.pathWriting || guarded}
          suppressTooltip={body.pathWriting}
          onClick={() => { body.onAskDiscard(row, hunkHeader) }}
        >
          <IconDiscardOutline16 size={ACTION_ICON_SIZE} />
        </IconAction>
      </>
    )
  }
  return (
    <IconAction
      label={t('git.hunk.unstage')}
      inactive={body.pathWriting}
      onClick={() => { body.onUnstage(row, hunkHeader) }}
    >
      <IconMinus size={ACTION_ICON_SIZE} />
    </IconAction>
  )
}

function DiffLineRow({
  lineNum, origin, text, charSpans, syntaxSpans, gutterActions,
}: {
  lineNum: number
  origin: GitDiffLine['origin']
  text: string
  charSpans?: CharSpan[] | undefined
  syntaxSpans?: readonly HighlightSpan[] | undefined
  gutterActions?: ReactNode
}): ReactNode {
  const prefix = origin === 'add' ? '+' : origin === 'del' ? '-' : ' '
  return (
    <div className={`${css.diffRow} ${diffRowClass(origin)}`} {...{ [DIFF_ROW_ATTR]: '' }}>
      <div className={css.diffGutterActions}>{gutterActions}</div>
      <div className={css.diffLineNum} aria-hidden="true">{lineNum > 0 ? String(lineNum) : ''}</div>
      <div className={css.diffPrefix} aria-hidden="true">{prefix}</div>
      <DiffLineContent origin={origin} text={text} charSpans={charSpans} syntaxSpans={syntaxSpans} />
    </div>
  )
}

function DiffLineContent({
  origin, text, charSpans, syntaxSpans,
}: {
  origin: GitDiffLine['origin']
  text: string
  charSpans?: CharSpan[] | undefined
  syntaxSpans?: readonly HighlightSpan[] | undefined
}): ReactNode {
  const baseClass = `${css.diffContent} ${diffLineClass(origin)}`
  const merged = mergeLineHighlight(text, syntaxSpans, charSpans)
  const plain = merged.length === 1
    && merged[0]?.charKind === 'same'
    && merged[0]?.style === undefined
  if (plain) {
    return <div className={baseClass}>{text}</div>
  }
  return (
    <div className={baseClass}>
      {merged.map((span, index) => (
        <span
          key={index}
          className={charSpanClass(origin, span.charKind)}
          style={span.style}
        >
          {span.text}
        </span>
      ))}
    </div>
  )
}

function charSpanClass(origin: GitDiffLine['origin'], kind: CharSpan['kind']): string | undefined {
  if (kind === 'same') return undefined
  if (origin === 'add' && kind === 'insert') return css.diffCharInsert
  if (origin === 'del' && kind === 'delete') return css.diffCharDelete
  return undefined
}

/** Toggle a folder section when the header receives Enter or Space. */
function onFolderHeadKeyDown(event: KeyboardEvent<HTMLDivElement>, toggle: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  toggle()
}

/** Working-tree chrome folder: branch, commit, and the two change lists. */
function ChangesSection({
  t, changeCount, children,
}: {
  t: GitPanelProps['t']
  changeCount: number
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(true)
  const title = t('git.section.changes')
  const toggleLabel = expanded ? t('git.section.collapse', { title }) : t('git.section.expand', { title })
  const toggleExpanded = useCallback(() => {
    setExpanded(open => !open)
  }, [])
  const bodyId = 'git-section-changes-body'
  return (
    <section
      className={`${css.section} ${css.folder} ${css.changesFolder}`}
      data-git-changes=""
      data-collapsed={expanded ? undefined : true}
    >
      <div
        className={`${css.sectionHead} ${css.folderHead}`}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={bodyId}
        aria-label={toggleLabel}
        onClick={toggleExpanded}
        onKeyDown={(event) => { onFolderHeadKeyDown(event, toggleExpanded) }}
      >
        <span className={css.sectionChevron} aria-hidden="true">
          {expanded
            ? <IconChevronDownOutline14 size={14} />
            : <IconChevronRightOutline14 size={14} />}
        </span>
        <h2 id="git-section-changes-title" className={`${css.sectionTitle} ${css.folderTitle}`}>{title}</h2>
        <div className={css.sectionHeadActions} onClick={(event) => { event.stopPropagation() }}>
          <span
            className={css.sectionCount}
            data-git-changes-count=""
            aria-label={String(changeCount)}
          >
            {changeCount}
          </span>
        </div>
      </div>
      {expanded && (
        <div id={bodyId} className={css.changesBody} aria-labelledby="git-section-changes-title">
          {children}
        </div>
      )}
    </section>
  )
}

function ChangeSection({
  id, title, rows, body,
}: {
  id: SectionId
  title: string
  rows: readonly GitWorkingTreeChange[]
  body: RepoBody
}) {
  const { t } = body
  const [expanded, setExpanded] = useState(true)
  const sectionGuarded = id === 'unstaged' && rows.some(row => body.dirtyPaths.includes(row.absolutePath))
  const sectionAction = id === 'unstaged'
    ? { label: t('git.stageAll'), onClick: () => { body.onStageAll(rows) } }
    : { label: t('git.unstageAll'), onClick: () => { body.onUnstageAll(rows) } }
  const toggleLabel = expanded ? t('git.section.collapse', { title }) : t('git.section.expand', { title })
  const toggleExpanded = useCallback(() => {
    setExpanded(open => !open)
  }, [])
  const listId = `git-section-${id}-list`
  return (
    <section className={css.section}>
      <div
        className={css.sectionHead}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-label={toggleLabel}
        onClick={toggleExpanded}
        onKeyDown={(event) => { onFolderHeadKeyDown(event, toggleExpanded) }}
      >
        <span className={css.sectionChevron} aria-hidden="true">
          {expanded
            ? <IconChevronDownOutline14 size={14} />
            : <IconChevronRightOutline14 size={14} />}
        </span>
        <h2 id={`git-section-${id}-title`} className={css.sectionTitle}>{title}</h2>
        <div
          className={css.sectionHeadActions}
          onClick={(event) => { event.stopPropagation() }}
        >
          {rows.length > 0 && (
            <IconAction
              label={sectionAction.label}
              inactive={body.pathWriting || sectionGuarded}
              suppressTooltip={body.pathWriting}
              onClick={sectionAction.onClick}
            >
              {id === 'unstaged' ? <IconPlusOutline16 size={ACTION_ICON_SIZE} /> : <IconMinus size={ACTION_ICON_SIZE} />}
            </IconAction>
          )}
          <span className={css.sectionCount} aria-label={t('git.section.count', { count: rows.length })}>
            {rows.length}
          </span>
        </div>
      </div>
      {expanded && (
        <ul id={listId} className={css.rowList} aria-labelledby={`git-section-${id}-title`}>
          {rows.map(row => (
            <ChangeRow key={`${id}:${row.absolutePath}`} id={id} row={row} body={body} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ChangeRow({
  id, row, body,
}: {
  id: SectionId
  row: GitWorkingTreeChange
  body: RepoBody
}) {
  const { t } = body
  const selected = body.selection?.side === id && body.selection.row.absolutePath === row.absolutePath
  const busy = body.busyPath === row.absolutePath
  const guarded = body.dirtyPaths.includes(row.absolutePath)
  const busyLabel = body.busyKind === 'unstage'
    ? t('git.busy.unstage')
    : body.busyKind === 'discard'
      ? t('git.busy.discard')
      : t('git.busy.stage')
  const { fileName, parentDir } = splitChangePath(row.path)
  const statusLetter = changeKindLetter(row.kind)
  const statusClass = row.kind === 'untracked'
    ? css.rowBadgeUntracked
    : row.kind === 'deleted'
      ? css.rowBadgeDeleted
      : css.rowBadgeModified
  return (
    <li
      className={selected ? `${css.row} ${css.rowSelected}` : css.row}
      aria-selected={selected || undefined}
      aria-label={row.path}
      data-change-path={row.path}
      onClick={() => { body.onSelect(id, row) }}
    >
      <span className={css.rowIcon} role="img" aria-label={t('git.icon.file')}>
        <img
          className={css.rowGlyph}
          src={fileIconUrlForPath(row.path)}
          width={16}
          height={16}
          alt=""
          decoding="async"
          onError={(event) => {
            const img = event.currentTarget
            if (img.src.endsWith(`${FILE_ICON_BASE_URL}/file.svg`)) return
            img.src = `${FILE_ICON_BASE_URL}/file.svg`
          }}
        />
      </span>
      <span className={css.rowLabel}>
        <span className={css.rowFileName}>{fileName}</span>
        {parentDir !== '' && <span className={css.rowParentDir}>{parentDir}</span>}
      </span>
      <span className={css.rowTail}>
        {busy
          ? (
            <span className={css.rowSpinner} role="status" aria-label={busyLabel}>
              <IconLoadingOutline16 size={16} />
            </span>
          )
          : (
            <span className={css.rowActions}>
              {id === 'unstaged'
                ? (
                  <>
                    <IconAction
                      label={t('git.stage')}
                      inactive={body.pathWriting || guarded}
                      suppressTooltip={body.pathWriting}
                      onClick={() => { body.onStage(row) }}
                    >
                      <IconPlusOutline16 size={ROW_ACTION_ICON_SIZE} />
                    </IconAction>
                    <IconAction
                      label={t('git.discard')}
                      inactive={body.pathWriting || guarded}
                      suppressTooltip={body.pathWriting}
                      onClick={() => { body.onAskDiscard(row) }}
                    >
                      <IconDiscardOutline16 size={ROW_ACTION_ICON_SIZE} />
                    </IconAction>
                  </>
                )
                : (
                  <IconAction
                    label={t('git.unstage')}
                    inactive={body.pathWriting}
                    suppressTooltip={body.pathWriting}
                    onClick={() => { body.onUnstage(row) }}
                  >
                    <IconMinus size={ROW_ACTION_ICON_SIZE} />
                  </IconAction>
                )}
            </span>
          )}
        <span
          className={`${css.rowBadge} ${statusClass}`}
          aria-label={t('git.change.status', { letter: statusLetter })}
        >
          {statusLetter}
        </span>
      </span>
    </li>
  )
}

function ActionConfirmDialog({
  action, branch, ahead, originUrl, t, anchor, onCancel, onConfirm,
}: {
  action: ConfirmAction
  branch: string
  ahead: number | undefined
  originUrl: string | undefined
  t: GitPanelProps['t']
  anchor: HTMLElement
  onCancel: () => void
  onConfirm: () => void
}): ReactNode {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>({ top: 0, left: 0 })
  let title: string
  let body: string
  let confirmLabel: string
  switch (action) {
    case 'commitPush':
      title = t('git.confirm.commitPush.title')
      body = t('git.confirm.commitPush.body', { branch })
      confirmLabel = t('git.confirm.commitPush.confirm')
      break
    case 'push':
      title = t('git.confirm.push.title')
      body = ahead !== undefined && ahead > 0
        ? t('git.confirm.push.bodyAhead', { branch, count: ahead })
        : t('git.confirm.push.body', { branch })
      confirmLabel = t('git.confirm.push.confirm')
      break
    case 'removeRemote':
      title = t('git.confirm.remoteRemove.title')
      body = t('git.confirm.remoteRemove.body', { url: originUrl ?? '' })
      confirmLabel = t('git.confirm.remoteRemove.confirm')
      break
    case 'commit':
      title = t('git.confirm.commit.title')
      body = t('git.confirm.commit.body', { branch })
      confirmLabel = t('git.confirm.commit.confirm')
      break
  }
  useLayoutEffect(() => {
    const place = () => {
      const card = cardRef.current
      /* v8 ignore next -- the card is attached before this layout effect. */
      if (card === null) return
      const box = confirmPopoverPosition(
        anchor.getBoundingClientRect(),
        { width: card.offsetWidth, height: card.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      )
      setPos({ top: box.top, left: box.left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor])
  return (
    <div
      ref={cardRef}
      className={`${css.dialogPopover} ${css.dialogCard}`}
      style={pos}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <h2 className={css.dialogTitle}>{title}</h2>
      <p className={css.dialogBody}>{body}</p>
      <div className={css.dialogActions}>
        <Button variant="outline" size="sm" onClick={onCancel}>{t('git.confirm.cancel')}</Button>
        <Button variant="primary" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

function GuardDialog({
  target, t, onCancel,
}: {
  target: GitWorkingTreeChange
  t: GitPanelProps['t']
  onCancel: () => void
}) {
  const title = t('git.guard.title')
  return (
    <div className={css.dialogRoot}>
      <div
        className={css.dialogCard}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className={css.dialogTitle}>{title}</h2>
        <p className={css.dialogPath}>{target.absolutePath}</p>
        <p className={css.dialogBody}>{t('git.guard.body')}</p>
        <div className={css.dialogActions}>
          <Button variant="outline" size="sm" onClick={onCancel}>{t('git.guard.cancel')}</Button>
        </div>
      </div>
    </div>
  )
}

function DiscardDialog({
  target, t, onCancel, onConfirm,
}: {
  target: GitWorkingTreeChange
  t: GitPanelProps['t']
  onCancel: () => void
  onConfirm: () => void
}) {
  const title = target.kind === 'untracked'
    ? t('git.discard.untracked.title')
    : t('git.discard.modified.title')
  const copy = target.kind === 'untracked'
    ? t('git.discard.untracked.body')
    : target.kind === 'deleted'
      ? t('git.discard.deleted.body')
      : t('git.discard.modified.body')
  const confirmLabel = target.kind === 'untracked'
    ? t('git.discard.untracked.confirm')
    : t('git.discard.confirm')
  return (
    <div className={css.dialogRoot}>
      <div
        className={css.dialogCard}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className={css.dialogTitle}>{title}</h2>
        <p className={css.dialogPath}>{target.path}</p>
        <p className={css.dialogBody}>{copy}</p>
        <div className={css.dialogActions}>
          <Button variant="outline" size="sm" onClick={onCancel}>{t('git.discard.cancel')}</Button>
          <Button variant="primary" size="sm" className={css.danger} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function IconAction({
  label, inactive, suppressTooltip, onClick, children,
}: {
  label: string
  /** Marks the control inactive for styling and assistive tech. */
  inactive: boolean
  /** Suppresses the hover tooltip while an operation is in flight. */
  suppressTooltip?: boolean | undefined
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip
      label={label}
      side="bottom"
      delayMs={ICON_TOOLTIP_DELAY_MS}
      disabled={suppressTooltip ?? inactive}
    >
      <button
        type="button"
        className={css.iconButton}
        aria-label={label}
        aria-disabled={inactive || undefined}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation()
          onClick()
        }}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function IconMinus({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M3 7.25h10v1.5H3z" />
    </svg>
  )
}

function retainSelection(
  current: Selection | null,
  tree: GitWorkingTreeResult,
): Selection | null {
  if (current === null || tree.availability !== 'repository') return null
  if (current.side === 'unstaged') {
    const row = tree.unstaged.find(item => item.absolutePath === current.row.absolutePath)
    return row === undefined ? null : { side: 'unstaged', row }
  }
  const row = tree.staged.find(item => item.absolutePath === current.row.absolutePath)
  return row === undefined ? null : { side: 'staged', row }
}

function invokeWrite(
  write: (workspaceId: WorkspaceId, path: string, hunkHeader?: string) => Promise<GitWorkingTreeResult>,
  workspaceId: WorkspaceId,
  path: string,
  hunkHeader?: string,
): Promise<GitWorkingTreeResult> {
  return hunkHeader === undefined ? write(workspaceId, path) : write(workspaceId, path, hunkHeader)
}

function diffLineClass(origin: GitDiffLine['origin']): string {
  switch (origin) {
    case 'add': return css.diffAdd as string
    case 'del': return css.diffDel as string
    case 'context': return css.diffContext as string
    /* v8 ignore next 2 -- closed-union backstop; only reached if a line origin is forged */
    default: return assertNever(origin)
  }
}

function diffRowClass(origin: GitDiffLine['origin']): string {
  switch (origin) {
    case 'add': return css.diffAddRow as string
    case 'del': return css.diffDelRow as string
    case 'context': return css.diffContextRow as string
    /* v8 ignore next 2 -- closed-union backstop; only reached if a line origin is forged */
    default: return assertNever(origin)
  }
}

function hostErrorMessage(error: unknown): string {
  if (error instanceof DirectoryBrowseError) return error.rpcError.message
  return error instanceof Error ? error.message : String(error)
}

function toolbarGitErrorMessage(t: GitPanelProps['t'], error: unknown): string {
  const raw = hostErrorMessage(error)
  if (isMissingRemoteGitError(raw)) return t('git.feedback.noRemote')
  if (isRejectedPushGitError(raw)) return t('git.feedback.pushRejected')
  return raw
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/* v8 ignore next 3 -- closed-union backstop; only reached if a preview kind or line origin is forged */
function assertNever(value: never): never {
  throw new Error(`unreachable Git preview variant: ${String(value)}`)
}
