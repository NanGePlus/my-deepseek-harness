/** Human-terminal occupant of the details column Terminal tab. */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import { IconCodeOutline16, IconLoadingOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  TerminalListResult, TerminalProfilesResult, TerminalSpawnResult,
  TerminalStreamFrame, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { createTerminalPanelStore, terminalWorkspaceState, type TerminalTabRow } from './stores.ts'
import { useHarnessDark } from './use-harness-dark.ts'
import { createXtermViewport, type XtermViewportHandle } from './xterm-viewport.ts'
import css from './TerminalPanel.module.css'

/** Host human-terminal callbacks closed over `ctx.workspaces` in apply. */
export interface TerminalPanelInjected {
  /**
   * List selectable interactive shell profiles.
   * @param signal - aborts a superseded read.
   */
  terminalProfiles: (signal?: AbortSignal) => Promise<TerminalProfilesResult>
  /**
   * List live human terminal sessions for one Workspace.
   * @param workspaceId - Workspace whose session pool is queried.
   * @param signal - aborts a superseded read.
   */
  terminalList: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<TerminalListResult>
  /**
   * Spawn one interactive human terminal session.
   * @param workspaceId - Workspace whose root bounds the default cwd.
   * @param profileId - optional shell profile.
   * @param cwd - optional initial cwd.
   * @param signal - aborts a superseded spawn.
   */
  terminalSpawn: (
    workspaceId: WorkspaceId,
    profileId?: string,
    cwd?: string,
    signal?: AbortSignal,
  ) => Promise<TerminalSpawnResult>
  /**
   * Write stdin bytes to one live human terminal session.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param text - UTF-8 stdin payload.
   * @param signal - aborts a superseded write.
   */
  terminalWrite: (
    workspaceId: WorkspaceId,
    sessionId: string,
    text: string,
    signal?: AbortSignal,
  ) => Promise<{ written: true }>
  /**
   * Resize one live human terminal session.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param cols - terminal column count.
   * @param rows - terminal row count.
   * @param signal - aborts a superseded resize.
   */
  terminalResize: (
    workspaceId: WorkspaceId,
    sessionId: string,
    cols: number,
    rows: number,
    signal?: AbortSignal,
  ) => Promise<{ resized: true }>
  /**
   * Subscribe to scrollback, incremental output, and title metadata.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param onFrame - invoked once per Host SSE frame.
   * @param signal - aborts the stream.
   * @param onOpen - invoked once response headers are readable.
   */
  terminalStream: (
    workspaceId: WorkspaceId,
    sessionId: string,
    onFrame: (frame: TerminalStreamFrame) => void,
    signal?: AbortSignal,
    onOpen?: () => void,
  ) => void
}

/** Props for the human terminal panel. */
export type TerminalPanelProps =
  & PropsRuntime<'conversation.details.terminal'>
  & PropsLocale<'terminalPanel'>
  & PropsStore<ReturnType<typeof createTerminalPanelStore>>
  & TerminalPanelInjected

/** Map Host list rows into store tab rows. */
function rowsFromList(sessions: TerminalListResult['sessions']): TerminalTabRow[] {
  return sessions.map(session => ({
    sessionId: session.sessionId,
    title: session.title,
    profileId: session.profileId,
  }))
}

/**
 * Human terminal body: workspace-bound tabs and one xterm viewport.
 * @param props - root runtime share, locale, workspace-partitioned store, and Host callbacks.
 * @returns the human terminal surface.
 */
export function TerminalPanel({
  t, visible, useSessions, useWorkspaces, useStore, actions,
  terminalProfiles, terminalList, terminalSpawn, terminalWrite, terminalResize, terminalStream,
}: TerminalPanelProps) {
  const dark = useHarnessDark()
  const currentSessionId = useSessions(state => state.current)
  const workspace = useWorkspaces(state =>
    state.items.find(item => currentSessionId !== undefined && item.sessionIds.includes(currentSessionId)),
  )
  const workspaceId = workspace?.workspaceId
  const tabs = useStore(state => workspaceId === undefined
    ? []
    : terminalWorkspaceState(state, workspaceId).tabs)
  const selectedSessionId = useStore(state => workspaceId === undefined
    ? undefined
    : terminalWorkspaceState(state, workspaceId).selectedSessionId)
  const connecting = useStore(state => workspaceId === undefined
    ? false
    : terminalWorkspaceState(state, workspaceId).connecting)
  const viewportHostRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<XtermViewportHandle | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)

  const ensureViewport = useCallback((): XtermViewportHandle | null => {
    if (workspaceId === undefined || selectedSessionId === undefined) return null
    if (viewportRef.current !== null) {
      viewportRef.current.setDark(dark)
      return viewportRef.current
    }
    const host = viewportHostRef.current
    if (host === null || host.clientWidth === 0) return null
    const wid = workspaceId
    const sessionId = selectedSessionId
    const viewport = createXtermViewport({
      dark,
      onInput: (text) => { void terminalWrite(wid, sessionId, text) },
      onResize: (cols, rows) => { void terminalResize(wid, sessionId, cols, rows) },
    })
    viewport.attach(host)
    viewportRef.current = viewport
    return viewport
  }, [dark, selectedSessionId, terminalResize, terminalWrite, workspaceId])

  useEffect(() => {
    if (!visible) return
    ensureViewport()
  }, [dark, ensureViewport, visible])

  useEffect(() => {
    if (!visible || workspaceId === undefined) return
    if (tabs.length > 0) return
    const ac = new AbortController()
    void (async () => {
      try {
        const listed = await terminalList(workspaceId, ac.signal)
        if (ac.signal.aborted) return
        if (listed.sessions.length > 0) {
          actions.setWorkspaceTabs(
            workspaceId,
            rowsFromList(listed.sessions),
            listed.sessions[0]?.sessionId,
          )
          return
        }
        actions.setConnecting(workspaceId, true)
        const profiles = await terminalProfiles(ac.signal)
        if (ac.signal.aborted) return
        const spawned = await terminalSpawn(
          workspaceId,
          profiles.defaultProfileId,
          workspace?.path,
          ac.signal,
        )
        if (ac.signal.aborted) return
        const profile = profiles.profiles.find(row => row.id === profiles.defaultProfileId)
        actions.upsertTab(workspaceId, {
          sessionId: spawned.sessionId,
          title: profile?.name ?? profiles.defaultProfileId,
          profileId: profiles.defaultProfileId,
        })
      } catch (error: unknown) {
        if (error instanceof DirectoryBrowseError || ac.signal.aborted) return
        throw error
      } finally {
        if (!ac.signal.aborted) actions.setConnecting(workspaceId, false)
      }
    })()
    return () => { ac.abort() }
  }, [
    actions, tabs.length, terminalList, terminalProfiles, terminalSpawn, visible, workspace?.path, workspaceId,
  ])

  useEffect(() => {
    if (!visible || workspaceId === undefined || selectedSessionId === undefined) return
    streamAbortRef.current?.abort()
    const ac = new AbortController()
    streamAbortRef.current = ac
    actions.setConnecting(workspaceId, true)
    terminalStream(workspaceId, selectedSessionId, (frame) => {
      if (frame.type === 'host/terminal-scrollback' || frame.type === 'host/terminal-output') {
        ensureViewport()?.write(frame.text)
      }
      if (frame.type === 'host/terminal-title') {
        actions.updateTabTitle(workspaceId, selectedSessionId, frame.title)
      }
    }, ac.signal, () => {
      actions.setConnecting(workspaceId, false)
    })
    return () => { ac.abort() }
  }, [
    actions, ensureViewport, selectedSessionId, terminalStream, visible, workspaceId,
  ])

  useEffect(() => {
    if (!visible || typeof ResizeObserver === 'undefined') return
    const host = viewportHostRef.current
    if (host === null) return
    const observer = new ResizeObserver(() => {
      if (host.clientWidth === 0) return
      try { ensureViewport()?.fit() } catch { /* mid-layout or hidden panel */ }
    })
    observer.observe(host)
    return () => { observer.disconnect() }
  }, [ensureViewport, selectedSessionId, visible])

  useEffect(() => () => {
    streamAbortRef.current?.abort()
    viewportRef.current?.dispose()
    viewportRef.current = null
  }, [])

  useEffect(() => {
    viewportRef.current?.dispose()
    viewportRef.current = null
  }, [selectedSessionId, workspaceId])

  const activeTab = useMemo(
    () => tabs.find(tab => tab.sessionId === selectedSessionId),
    [selectedSessionId, tabs],
  )

  if (workspaceId === undefined) {
    return (
      <div className={css.root} data-surface="human-terminal">
        <div className={css.overlay}>
          <div className={css.emptyCard}>
            <span className={css.emptyIcon} aria-hidden="true">
              <IconCodeOutline16 size={48} />
            </span>
            <div className={css.emptyTitle}>{t('terminal.empty.unbound.title')}</div>
            <div className={css.emptyBody}>{t('terminal.empty.unbound.body')}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={css.root} data-surface="human-terminal">
      <div className={css.tabBar}>
        <div className={css.tablist} role="tablist" aria-label={t('terminal.tab.aria')}>
          {tabs.map(tab => (
            <button
              key={tab.sessionId}
              type="button"
              role="tab"
              aria-selected={tab.sessionId === selectedSessionId}
              className={clsx(css.tab, tab.sessionId === selectedSessionId && css.tabActive)}
              onClick={() => { actions.setSelectedSession(workspaceId, tab.sessionId) }}
            >
              <span className={css.tabTitle}>{tab.title}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={css.body}>
        <div
          ref={viewportHostRef}
          className={css.viewportHost}
          role="tabpanel"
          aria-label={t('terminal.viewport.aria')}
          aria-busy={connecting}
        />
        {connecting
          ? (
            <div className={css.loadingOverlay}>
              <span className={css.spinner} aria-hidden="true">
                <IconLoadingOutline16 size={24} />
              </span>
              <div className={css.loadingCopy}>{t('terminal.loading.connecting')}</div>
            </div>
          )
          : null}
      </div>
      <span className={css.hidden}>{activeTab?.title ?? ''}</span>
    </div>
  )
}
