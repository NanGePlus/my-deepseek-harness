/** Git-panel occupant of the details column Git tab. */

import { useEffect, useState, type ReactNode } from 'react'
import { Button, IconCodeOutline16, IconFolderClose16, IconLoadingOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  GitInitResult, GitWorkingTreeChange, GitWorkingTreeResult, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { fileIconUrlForPath, FILE_ICON_BASE_URL } from './file-icon.ts'
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
}

/** Full Git-panel props: runtime share, locale, visibility, and Host Git callbacks. */
export type GitPanelProps =
  PropsRuntime<'conversation.details.git'>
  & PropsLocale<'gitPanel'>
  & GitPanelInjected

type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; tree: GitWorkingTreeResult }
  | { kind: 'refreshing'; tree: GitWorkingTreeResult }
  | { kind: 'error'; message: string }

/**
 * Git panel body: branch, commit placeholder, two change lists, and empty states.
 * @param props - root runtime share, locale, visibility, and Host Git callbacks.
 * @returns the Git panel surface.
 */
export function GitPanel({
  t, visible, useSessions, useWorkspaces, gitWorkingTree, gitInit,
}: GitPanelProps) {
  const currentSessionId = useSessions(state => state.current)
  const workspace = useWorkspaces(state =>
    state.items.find(item => currentSessionId !== undefined && item.sessionIds.includes(currentSessionId)),
  )
  const workspaceId = workspace?.workspaceId
  const [view, setView] = useState<ViewState>({ kind: 'idle' })
  const [reloadEpoch, setReloadEpoch] = useState(0)
  const [initError, setInitError] = useState<string | null>(null)
  const [initPending, setInitPending] = useState(false)

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
      setView({ kind: 'ready', tree })
    }).catch((error: unknown) => {
      if (isAbortError(error) || ac.signal.aborted) return
      setView({ kind: 'error', message: hostErrorMessage(error) })
    })
    return () => { ac.abort() }
  }, [visible, workspaceId, gitWorkingTree, reloadEpoch])

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

  return (
    <div className={css.root} data-surface="git-panel">
      {renderBody(view, t, onInit, initError, initPending)}
    </div>
  )
}

function renderBody(
  view: ViewState,
  t: GitPanelProps['t'],
  onInit: () => void,
  initError: string | null,
  initPending: boolean,
): ReactNode {
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
  const refreshing = view.kind === 'refreshing'
  const clean = tree.unstaged.length === 0 && tree.staged.length === 0
  return (
    <div className={css.split}>
      <div className={css.ops}>
        {refreshing
          ? <div className={css.refreshBar} role="progressbar" aria-label={t('git.refresh')} />
          : <div className={css.refreshSlot} />}
        <div className={css.branch}>{t('git.branch', { name: tree.branch })}</div>
        <textarea
          className={css.commitInput}
          placeholder={t('git.commit.placeholder')}
          aria-label={t('git.commit.placeholder')}
          rows={3}
        />
        <Button variant="primary" size="sm" disabled>
          {t('git.commit.submit')}
        </Button>
        <div className={css.lists}>
          {clean && <div className={css.cleanEmpty}>{t('git.empty.clean')}</div>}
          <ChangeSection
            title={t('git.section.unstaged')}
            rows={tree.unstaged}
            t={t}
          />
          <ChangeSection
            title={t('git.section.staged')}
            rows={tree.staged}
            t={t}
          />
        </div>
      </div>
      <div className={css.gutter} aria-hidden="true" />
      <div className={css.preview}>
        <div className={css.previewEmpty}>{t('git.empty.preview')}</div>
      </div>
    </div>
  )
}

function ChangeSection({
  title, rows, t,
}: {
  title: string
  rows: readonly GitWorkingTreeChange[]
  t: GitPanelProps['t']
}) {
  return (
    <section className={css.section}>
      <h2 className={css.sectionTitle}>{title}</h2>
      <ul className={css.rowList}>
        {rows.map(row => (
          <li key={row.absolutePath} className={css.row}>
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
          </li>
        ))}
      </ul>
    </section>
  )
}

function hostErrorMessage(error: unknown): string {
  if (error instanceof DirectoryBrowseError) return error.rpcError.message
  return error instanceof Error ? error.message : String(error)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
