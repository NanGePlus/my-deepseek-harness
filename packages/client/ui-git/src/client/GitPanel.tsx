/** Git-panel occupant of the details column Git tab. */

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Button, IconCodeOutline16, IconFolderClose16, IconLoadingOutline16, IconPlusOutline16,
  IconRefreshOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  GitDiffHunk, GitDiffLine, GitDiffPreview, GitDiffSide, GitInitResult, GitWorkingTreeChange,
  GitWorkingTreeResult, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { fileIconUrlForPath, FILE_ICON_BASE_URL } from './file-icon.ts'
import type { createGitPanelStore } from './stores.ts'
import css from './GitPanel.module.css'

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
   * @param message - commit message; the Host rejects a blank-after-trim value.
   * @returns the refreshed working tree.
   */
  gitCommit: (workspaceId: WorkspaceId, message: string) => Promise<GitWorkingTreeResult>
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
  | { kind: 'ready'; preview: GitDiffPreview }
  | { kind: 'error'; message: string }

interface DiscardTarget {
  row: GitWorkingTreeChange
  hunkHeader?: string
}

/**
 * Git panel body: branch, commit message, two change lists, and in-panel diff preview.
 * @param props - root runtime share, locale, draft store, visibility, and Host Git callbacks.
 * @returns the Git panel surface.
 */
export function GitPanel({
  t, visible, useSessions, useWorkspaces, useStore, actions,
  gitWorkingTree, gitInit, gitDiffPreview, gitStage, gitUnstage, gitDiscard, gitCommit,
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
  const [commitError, setCommitError] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [busyKind, setBusyKind] = useState<'stage' | 'unstage' | 'discard' | null>(null)
  const [commitPending, setCommitPending] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' })

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
      setCommitError(false)
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
    if (selection === null) {
      setPreview({ kind: 'idle' })
      return
    }
    if (!visible || workspaceId === undefined) return
    const ac = new AbortController()
    const selected = selection
    setPreview({ kind: 'loading' })
    void gitDiffPreview(workspaceId, selected.row.absolutePath, selected.side, ac.signal).then((value) => {
      if (ac.signal.aborted) return
      setPreview({ kind: 'ready', preview: value })
    }).catch((error: unknown) => {
      if (isAbortError(error) || ac.signal.aborted) return
      setPreview({ kind: 'error', message: hostErrorMessage(error) })
    })
    return () => { ac.abort() }
  }, [visible, workspaceId, selection, gitDiffPreview, previewEpoch])

  const writing = busyPath !== null || commitPending

  const applyTree = (tree: GitWorkingTreeResult): void => {
    setWriteError(null)
    setCommitError(false)
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
    if (workspaceId === undefined || writing) return false
    setBusyPath(path)
    setBusyKind(kind)
    setWriteError(null)
    setCommitError(false)
    try {
      applyTree(await write())
      return true
    } catch (error: unknown) {
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

  const onCommit = (): void => {
    const trimmed = message.trim()
    /* v8 ignore next -- Submit is disabled until a Session-bound repository has staged files and a message. */
    if (workspaceId === undefined || currentSessionId === undefined || writing || trimmed === '') return
    setCommitPending(true)
    setWriteError(null)
    setCommitError(false)
    void gitCommit(workspaceId, trimmed).then((tree) => {
      setCommitPending(false)
      applyTree(tree)
      actions.clearDraft(currentSessionId)
    }).catch((error: unknown) => {
      setCommitPending(false)
      setCommitError(true)
      setWriteError(hostErrorMessage(error))
    })
  }

  return (
    <div className={css.root} data-surface="git-panel">
      {renderBody({
        view, t, onInit, initError, initPending, writeError, commitError, message, busyPath, busyKind,
        commitPending, discardTarget, writing, selection, preview,
        onMessage: (value) => {
          /* v8 ignore next -- the commit field only renders for a current Session. */
          if (currentSessionId === undefined) return
          actions.setDraft(currentSessionId, value)
        },
        onSelect: (side, row) => {
          setSelection((current) => {
            if (current?.side === side && current.row.absolutePath === row.absolutePath) return current
            return { side, row }
          })
        },
        onStage: (row, hunkHeader) => {
          /* v8 ignore next -- row actions only render after a Workspace-bound repository read. */
          if (workspaceId === undefined) return
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
          void runSection(rows, 'stage', path => gitStage(workspaceId, path))
        },
        onUnstageAll: (rows) => {
          /* v8 ignore next -- section actions only render after a Workspace-bound repository read. */
          if (workspaceId === undefined) return
          void runSection(rows, 'unstage', path => gitUnstage(workspaceId, path))
        },
        onAskDiscard: (row, hunkHeader) => { setDiscardTarget({ row, hunkHeader }) },
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
        onCommit, onRetryCommit: onCommit,
      })}
    </div>
  )
}

interface RepoBody {
  view: ViewState
  t: GitPanelProps['t']
  onInit: () => void
  initError: string | null
  initPending: boolean
  writeError: string | null
  commitError: boolean
  message: string
  busyPath: string | null
  busyKind: 'stage' | 'unstage' | 'discard' | null
  commitPending: boolean
  discardTarget: DiscardTarget | null
  writing: boolean
  selection: Selection | null
  preview: PreviewState
  onMessage: (value: string) => void
  onSelect: (side: SectionId, row: GitWorkingTreeChange) => void
  onStage: (row: GitWorkingTreeChange, hunkHeader?: string) => void
  onUnstage: (row: GitWorkingTreeChange, hunkHeader?: string) => void
  onStageAll: (rows: readonly GitWorkingTreeChange[]) => void
  onUnstageAll: (rows: readonly GitWorkingTreeChange[]) => void
  onAskDiscard: (row: GitWorkingTreeChange, hunkHeader?: string) => void
  onCancelDiscard: () => void
  onConfirmDiscard: () => void
  onCommit: () => void
  onRetryCommit: () => void
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
  const { t, message, writeError, commitError, commitPending, discardTarget } = body
  const clean = tree.unstaged.length === 0 && tree.staged.length === 0
  const messageEmpty = message.trim() === ''
  const stagedEmpty = tree.staged.length === 0
  const showEmptyHint = !stagedEmpty && messageEmpty
  const commitDisabled = stagedEmpty || messageEmpty || commitPending || body.writing
  return (
    <div className={css.split}>
      <div className={css.ops}>
        {refreshing
          ? <div className={css.refreshBar} role="progressbar" aria-label={t('git.refresh')} />
          : <div className={css.refreshSlot} />}
        <div className={css.branch}>{t('git.branch', { name: tree.branch })}</div>
        <textarea
          className={showEmptyHint ? `${css.commitInput} ${css.commitInputError}` : css.commitInput}
          placeholder={t('git.commit.placeholder')}
          aria-label={t('git.commit.placeholder')}
          aria-invalid={showEmptyHint || undefined}
          rows={3}
          value={message}
          onChange={(event) => { body.onMessage(event.target.value) }}
        />
        {showEmptyHint && <div className={css.errorCopy}>{t('git.commit.empty')}</div>}
        <Button
          variant="primary"
          size="sm"
          disabled={commitDisabled}
          aria-label={t('git.commit.submit')}
          onClick={body.onCommit}
        >
          {commitPending && (
            <span className={css.buttonSpinner} role="status" aria-label={t('git.busy.commit')}>
              <IconLoadingOutline16 size={16} />
            </span>
          )}
          {t('git.commit.submit')}
        </Button>
        {writeError !== null && (
          <div className={css.errorCopy} role="alert">
            <div>{writeError}</div>
            {!stagedEmpty && !messageEmpty && commitError && (
              <button type="button" className={css.retry} onClick={body.onRetryCommit}>
                {t('git.commit.retry')}
              </button>
            )}
          </div>
        )}
        <div className={css.lists}>
          {clean && <div className={css.cleanEmpty}>{t('git.empty.clean')}</div>}
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
      </div>
      <div className={css.gutter} aria-hidden="true" />
      <DiffPreviewPane body={body} />
      {discardTarget !== null && (
        <DiscardDialog
          target={discardTarget.row}
          t={t}
          onCancel={body.onCancelDiscard}
          onConfirm={body.onConfirmDiscard}
        />
      )}
    </div>
  )
}

function DiffPreviewPane({ body }: { body: RepoBody }): ReactNode {
  const { t, selection, preview } = body
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
            <div className={css.previewBody}>
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
              {preview.kind === 'ready' && renderPreviewKind(preview.preview, selection, body)}
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
  if (side === 'unstaged') {
    return (
      <span className={css.rowActions}>
        <IconAction
          label={t('git.stage')}
          disabled={body.writing}
          onClick={() => { body.onStage(row) }}
        >
          <IconPlusOutline16 size={14} />
        </IconAction>
        <IconAction
          label={t('git.discard')}
          disabled={body.writing}
          onClick={() => { body.onAskDiscard(row) }}
        >
          <IconRefreshOutline16 size={14} />
        </IconAction>
      </span>
    )
  }
  return (
    <span className={css.rowActions}>
      <IconAction
        label={t('git.unstage')}
        disabled={body.writing}
        onClick={() => { body.onUnstage(row) }}
      >
        <IconMinus size={14} />
      </IconAction>
    </span>
  )
}

function renderPreviewKind(
  preview: GitDiffPreview,
  selection: Selection,
  body: RepoBody,
): ReactNode {
  switch (preview.kind) {
    case 'text':
      return preview.hunks.map(hunk => (
        <DiffHunkBlock
          key={hunk.header}
          hunk={hunk}
          selection={selection}
          body={body}
        />
      ))
    case 'untracked-text':
      return contentLines(preview.text).map((line, index) => (
        <DiffLineRow key={index} origin="add" text={line} />
      ))
    case 'deleted-text':
      return contentLines(preview.text).map((line, index) => (
        <DiffLineRow key={index} origin="del" text={line} />
      ))
    case 'binary':
    case 'deleted-binary':
      return (
        <div className={css.binaryWrap}>
          <div className={css.emptyCard}>
            <div className={css.emptyTitle}>{body.t('git.preview.binary')}</div>
          </div>
        </div>
      )
    /* v8 ignore next 4 -- closed-union backstop; only reached if a preview kind is forged */
    default: {
      return assertNever(preview)
    }
  }
}

function DiffHunkBlock({
  hunk, selection, body,
}: {
  hunk: GitDiffHunk
  selection: Selection
  body: RepoBody
}): ReactNode {
  const { t } = body
  return (
    <div className={css.hunk}>
      <div className={css.hunkHead}>
        {selection.side === 'unstaged'
          ? (
            <>
              <HunkAction
                label={t('git.hunk.stage')}
                disabled={body.writing}
                onClick={() => { body.onStage(selection.row, hunk.header) }}
              />
              <HunkAction
                label={t('git.hunk.discard')}
                disabled={body.writing}
                onClick={() => { body.onAskDiscard(selection.row, hunk.header) }}
              />
            </>
          )
          : (
            <HunkAction
              label={t('git.hunk.unstage')}
              disabled={body.writing}
              onClick={() => { body.onUnstage(selection.row, hunk.header) }}
            />
          )}
      </div>
      {hunk.lines.map((line, index) => (
        <DiffLineRow key={index} origin={line.origin} text={line.text} />
      ))}
    </div>
  )
}

function DiffLineRow({ origin, text }: { origin: GitDiffLine['origin']; text: string }): ReactNode {
  return (
    <div className={`${css.diffLine} ${diffLineClass(origin)}`}>{text}</div>
  )
}

function HunkAction({
  label, disabled, onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}): ReactNode {
  return (
    <button
      type="button"
      className={css.hunkAction}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    >
      {label}
    </button>
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
  const sectionAction = id === 'unstaged'
    ? { label: t('git.stageAll'), onClick: () => { body.onStageAll(rows) } }
    : { label: t('git.unstageAll'), onClick: () => { body.onUnstageAll(rows) } }
  return (
    <section className={css.section}>
      <div className={css.sectionHead}>
        <h2 className={css.sectionTitle}>{title}</h2>
        {rows.length > 0 && (
          <IconAction
            label={sectionAction.label}
            disabled={body.writing}
            onClick={sectionAction.onClick}
          >
            {id === 'unstaged' ? <IconPlusOutline16 size={14} /> : <IconMinus size={14} />}
          </IconAction>
        )}
      </div>
      <ul className={css.rowList}>
        {rows.map(row => (
          <ChangeRow key={`${id}:${row.absolutePath}`} id={id} row={row} body={body} />
        ))}
      </ul>
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
  const busyLabel = body.busyKind === 'unstage'
    ? t('git.busy.unstage')
    : body.busyKind === 'discard'
      ? t('git.busy.discard')
      : t('git.busy.stage')
  return (
    <li
      className={selected ? `${css.row} ${css.rowSelected}` : css.row}
      aria-selected={selected || undefined}
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
      <span className={css.rowPath}>{row.path}</span>
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
                    disabled={body.writing}
                    onClick={() => { body.onStage(row) }}
                  >
                    <IconPlusOutline16 size={14} />
                  </IconAction>
                  <IconAction
                    label={t('git.discard')}
                    disabled={body.writing}
                    onClick={() => { body.onAskDiscard(row) }}
                  >
                    <IconRefreshOutline16 size={14} />
                  </IconAction>
                </>
              )
              : (
                <IconAction
                  label={t('git.unstage')}
                  disabled={body.writing}
                  onClick={() => { body.onUnstage(row) }}
                >
                  <IconMinus size={14} />
                </IconAction>
              )}
          </span>
        )}
    </li>
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
            {t('git.discard')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function IconAction({
  label, disabled, onClick, children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={css.iconButton}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        if (disabled) return
        onClick()
      }}
    >
      {children}
    </button>
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

function contentLines(text: string): string[] {
  if (text === '') return ['']
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  return body.split('\n')
}

function diffLineClass(origin: GitDiffLine['origin']): string {
  switch (origin) {
    case 'add': return css.diffAdd
    case 'del': return css.diffDel
    case 'context': return css.diffContext
    /* v8 ignore next 2 -- closed-union backstop; only reached if a line origin is forged */
    default: return assertNever(origin)
  }
}

function hostErrorMessage(error: unknown): string {
  if (error instanceof DirectoryBrowseError) return error.rpcError.message
  return error instanceof Error ? error.message : String(error)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/* v8 ignore next 3 -- closed-union backstop; only reached if a preview kind or line origin is forged */
function assertNever(value: never): never {
  throw new Error(`unreachable Git preview variant: ${String(value)}`)
}
