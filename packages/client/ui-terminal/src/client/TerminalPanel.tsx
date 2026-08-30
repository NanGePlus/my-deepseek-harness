/** Human-terminal occupant of the details column Terminal tab. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconCloseOutline16, IconCodeOutline16, IconLoadingOutline16, IconPlusOutline16, Menu,
  Button, Modal, Tooltip,
  type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
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
import {
  sanitizeTerminalScrollbackForReplay,
  waitForXtermViewportFit,
} from './xterm-scrollback-replay.ts'
import {
  type TerminalTabCloseScope,
  sessionIdsForTabCloseScope,
  surviveSessionIdAfterTabClose,
  terminalTabCloseMenuState,
  wouldCloseEveryTerminalTab,
} from './terminal-tab-close-scope.ts'
import { terminalTabHasRunningCommand } from './tab-running-command.ts'
import { terminalTabDisplayTitle, terminalTabTitleCommand } from './terminal-tab-title.ts'
import css from './TerminalPanel.module.css'

const TOOLTIP_DELAY_MS = 500

/** Pending close after the user confirms terminating running foreground commands. */
interface PendingTerminalClose {
  sessionIds: readonly string[]
  surviveSessionId: string | undefined
  runningTitles: readonly string[]
}

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
   * Kill one live human terminal session and release its PTY.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param signal - aborts a superseded kill.
   */
  terminalKill: (
    workspaceId: WorkspaceId,
    sessionId: string,
    signal?: AbortSignal,
  ) => Promise<{ killed: true }>
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
    onError?: (message: string) => void,
  ) => void
}

/** Props for the human terminal panel. */
export type TerminalPanelProps =
  & PropsRuntime<'conversation.details.terminal'>
  & PropsLocale<'terminalPanel'>
  & PropsStore<ReturnType<typeof createTerminalPanelStore>>
  & TerminalPanelInjected

/** Return a user-visible Host failure message when one exists. */
function browseErrorMessage(error: unknown): string | undefined {
  if (error instanceof DirectoryBrowseError) return error.rpcError.message
  if (error instanceof Error) return error.message
  return undefined
}

/** Ignore workspace lookup failures during background handshakes. */
function isIgnorableBrowseError(error: DirectoryBrowseError): boolean {
  return error.rpcError.code === 'workspace-not-found'
}

/** Map a Host failure to the unavailable card or inline error surface. */
function reportTerminalFailure(
  actions: TerminalPanelProps['actions'],
  workspaceId: WorkspaceId,
  error: unknown,
  hasTabs: boolean,
): void {
  if (error instanceof DirectoryBrowseError && isIgnorableBrowseError(error)) return
  const message = browseErrorMessage(error)
  if (message === undefined) return
  actions.setInlineError(workspaceId, undefined)
  if (
    !hasTabs
    && error instanceof DirectoryBrowseError
    && error.rpcError.code === 'terminal-unavailable'
  ) {
    actions.setUnavailableMessage(workspaceId, message)
    return
  }
  actions.setUnavailableMessage(workspaceId, undefined)
  actions.setInlineError(workspaceId, message)
}

/** Map Host list rows into store tab rows. */
function rowsFromList(sessions: TerminalListResult['sessions']): TerminalTabRow[] {
  return sessions.map(session => ({
    sessionId: session.sessionId,
    title: session.title,
    titlePath: session.titlePath,
    titleCommand: session.titleCommand,
    profileId: session.profileId,
  }))
}

/** Render one terminal tab label (command only). */
function renderTerminalTabTitle(tab: TerminalTabRow) {
  const label = terminalTabTitleCommand(tab)
  return <span className={css.tabTitle}>{label}</span>
}

/**
 * Human terminal body: workspace-bound tabs and one xterm viewport.
 * @param props - root runtime share, locale, workspace-partitioned store, and Host callbacks.
 * @returns the human terminal surface.
 */
export function TerminalPanel({
  t, visible, useSessions, useWorkspaces, useStore, actions,
  terminalProfiles, terminalList, terminalSpawn, terminalWrite, terminalResize, terminalKill,
  terminalStream,
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
  const spawning = useStore(state => workspaceId === undefined
    ? false
    : terminalWorkspaceState(state, workspaceId).spawning)
  const unavailableMessage = useStore(state => workspaceId === undefined
    ? undefined
    : terminalWorkspaceState(state, workspaceId).unavailableMessage)
  const inlineError = useStore(state => workspaceId === undefined
    ? undefined
    : terminalWorkspaceState(state, workspaceId).inlineError)
  const deferAutoSpawn = useStore(state => workspaceId === undefined
    ? false
    : terminalWorkspaceState(state, workspaceId).deferAutoSpawn)
  const wasVisibleRef = useRef(false)
  const viewportHostRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<XtermViewportHandle | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const profilesRef = useRef<TerminalProfilesResult | null>(null)
  const addMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const pendingSpawnProfileRef = useRef<string | undefined>(undefined)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [tabMenu, setTabMenu] = useState<{ anchorSessionId: string; rect: DOMRect } | null>(null)
  const [pendingClose, setPendingClose] = useState<PendingTerminalClose | null>(null)
  const [profileMenuItems, setProfileMenuItems] = useState<readonly MenuEntry[]>([])
  const [streamAttempt, setStreamAttempt] = useState(0)

  const openAddMenu = useCallback(async () => {
    if (workspaceId === undefined || spawning) return
    const ac = new AbortController()
    try {
      const profiles = profilesRef.current ?? await terminalProfiles(ac.signal)
      if (ac.signal.aborted) return
      profilesRef.current = profiles
      setProfileMenuItems(profiles.profiles.map(profile => ({
        id: profile.id,
        label: profile.name,
      })))
      setAddMenuOpen(true)
    } catch (error: unknown) {
      if (error instanceof DirectoryBrowseError || ac.signal.aborted) return
      throw error
    }
  }, [spawning, terminalProfiles, workspaceId])

  const spawnTab = useCallback(async (profileId: string) => {
    if (workspaceId === undefined || spawning) return
    setAddMenuOpen(false)
    pendingSpawnProfileRef.current = profileId
    const ac = new AbortController()
    const hadTabs = tabs.length > 0
    try {
      actions.setSpawning(workspaceId, true)
      actions.setInlineError(workspaceId, undefined)
      actions.setUnavailableMessage(workspaceId, undefined)
      const profiles = profilesRef.current ?? await terminalProfiles(ac.signal)
      if (ac.signal.aborted) return
      profilesRef.current = profiles
      const spawned = await terminalSpawn(workspaceId, profileId, workspace?.path, ac.signal)
      if (ac.signal.aborted) return
      const profile = profiles.profiles.find(row => row.id === profileId)
      actions.upsertTab(workspaceId, {
        sessionId: spawned.sessionId,
        title: profile?.name ?? profileId,
        profileId,
      })
      actions.setSelectedSession(workspaceId, spawned.sessionId)
    } catch (error: unknown) {
      if (ac.signal.aborted) return
      reportTerminalFailure(actions, workspaceId, error, hadTabs)
    } finally {
      if (!ac.signal.aborted) actions.setSpawning(workspaceId, false)
    }
  }, [actions, spawning, tabs.length, terminalProfiles, terminalSpawn, workspace?.path, workspaceId])

  const killTab = useCallback(async (sessionId: string) => {
    if (workspaceId === undefined) return
    const ac = new AbortController()
    try {
      await terminalKill(workspaceId, sessionId, ac.signal)
      if (ac.signal.aborted) return
      actions.removeTab(workspaceId, sessionId)
    } catch (error: unknown) {
      if (error instanceof DirectoryBrowseError || ac.signal.aborted) return
      throw error
    }
  }, [actions, terminalKill, workspaceId])

  const executeCloseSessions = useCallback(async (
    sessionIds: readonly string[],
    surviveSessionId: string | undefined,
  ) => {
    if (workspaceId === undefined) return
    for (const sessionId of sessionIds) {
      await killTab(sessionId)
    }
    if (
      surviveSessionId !== undefined
      && tabsRef.current.some(tab => tab.sessionId === surviveSessionId)
    ) {
      actions.setSelectedSession(workspaceId, surviveSessionId)
    }
  }, [actions, killTab, workspaceId])

  const requestCloseSessions = useCallback((
    sessionIds: readonly string[],
    surviveSessionId: string | undefined,
  ) => {
    const currentTabs = tabsRef.current
    if (wouldCloseEveryTerminalTab(currentTabs, sessionIds)) return
    const runningTitles = sessionIds
      .map(sessionId => currentTabs.find(tab => tab.sessionId === sessionId))
      .filter((tab): tab is TerminalTabRow => tab !== undefined && terminalTabHasRunningCommand(tab))
      .map(tab => terminalTabDisplayTitle(tab))
    if (runningTitles.length > 0) {
      setPendingClose({ sessionIds, surviveSessionId, runningTitles })
      return
    }
    void executeCloseSessions(sessionIds, surviveSessionId)
  }, [executeCloseSessions])

  const handleCloseTab = useCallback((sessionId: string) => {
    requestCloseSessions([sessionId], undefined)
  }, [requestCloseSessions])

  const handleCloseTabs = useCallback((scope: TerminalTabCloseScope, anchorSessionId: string) => {
    const currentTabs = tabsRef.current
    const sessionIds = sessionIdsForTabCloseScope(currentTabs, anchorSessionId, scope)
    if (sessionIds.length === 0) return
    const surviveSessionId = surviveSessionIdAfterTabClose(currentTabs, anchorSessionId, scope)
    requestCloseSessions(sessionIds, surviveSessionId)
  }, [requestCloseSessions])

  const confirmPendingClose = useCallback(() => {
    if (pendingClose === null) return
    const { sessionIds, surviveSessionId } = pendingClose
    setPendingClose(null)
    void executeCloseSessions(sessionIds, surviveSessionId)
  }, [executeCloseSessions, pendingClose])

  const cancelPendingClose = useCallback(() => {
    setPendingClose(null)
  }, [])

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
      onInput: (text) => {
        void terminalWrite(wid, sessionId, text).then(() => {
          actions.setInlineError(wid, undefined)
        }).catch((error: unknown) => {
          reportTerminalFailure(actions, wid, error, true)
        })
      },
      onResize: (cols, rows) => { void terminalResize(wid, sessionId, cols, rows) },
    })
    viewport.attach(host)
    viewportRef.current = viewport
    return viewport
  }, [actions, dark, selectedSessionId, terminalResize, terminalWrite, workspaceId])

  const ensureViewportRef = useRef(ensureViewport)
  ensureViewportRef.current = ensureViewport
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  const retryUnavailable = useCallback(() => {
    if (workspaceId === undefined) return
    actions.setUnavailableMessage(workspaceId, undefined)
    actions.setInlineError(workspaceId, undefined)
    actions.setDeferAutoSpawn(workspaceId, false)
  }, [actions, workspaceId])

  const retryInline = useCallback(() => {
    if (workspaceId === undefined) return
    actions.setInlineError(workspaceId, undefined)
    const pendingProfile = pendingSpawnProfileRef.current
    if (pendingProfile !== undefined) {
      void spawnTab(pendingProfile)
      return
    }
    setStreamAttempt(attempt => attempt + 1)
  }, [actions, spawnTab, workspaceId])

  useEffect(() => {
    viewportRef.current?.dispose()
    viewportRef.current = null
  }, [selectedSessionId, workspaceId])

  useEffect(() => {
    if (!visible) return
    ensureViewport()
  }, [dark, ensureViewport, visible])

  useEffect(() => {
    if (!visible || workspaceId === undefined) {
      wasVisibleRef.current = visible
      return
    }
    const reentered = !wasVisibleRef.current
    wasVisibleRef.current = visible
    if (reentered) actions.setDeferAutoSpawn(workspaceId, false)
    if (tabs.length > 0) return
    if (!reentered && deferAutoSpawn) return
    if (unavailableMessage !== undefined) return
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
        actions.setSpawning(workspaceId, true)
        actions.setInlineError(workspaceId, undefined)
        actions.setUnavailableMessage(workspaceId, undefined)
        const profiles = await terminalProfiles(ac.signal)
        if (ac.signal.aborted) return
        profilesRef.current = profiles
        pendingSpawnProfileRef.current = profiles.defaultProfileId
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
        if (ac.signal.aborted) return
        reportTerminalFailure(actions, workspaceId, error, false)
      } finally {
        if (!ac.signal.aborted) actions.setSpawning(workspaceId, false)
      }
    })()
    return () => { ac.abort() }
  }, [
    actions, deferAutoSpawn, tabs.length, terminalList, terminalProfiles, terminalSpawn,
    unavailableMessage, visible, workspace?.path, workspaceId,
  ])

  useEffect(() => {
    if (workspaceId === undefined || selectedSessionId === undefined) return
    streamAbortRef.current?.abort()
    const ac = new AbortController()
    streamAbortRef.current = ac
    if (visibleRef.current) actions.setConnecting(workspaceId, true)
    let scrollbackSeen = false
    let replayReady = false
    const queuedFrames: TerminalStreamFrame[] = []

    const handleFrame = (frame: TerminalStreamFrame): void => {
      if (frame.type === 'host/terminal-scrollback' || frame.type === 'host/terminal-output') {
        if (!scrollbackSeen && frame.type === 'host/terminal-scrollback') {
          scrollbackSeen = true
          ensureViewportRef.current()?.setInputEnabled(true)
        }
        const text = frame.type === 'host/terminal-scrollback'
          ? sanitizeTerminalScrollbackForReplay(frame.text)
          : frame.text
        ensureViewportRef.current()?.write(text)
      }
      if (frame.type === 'host/terminal-title') {
        actions.updateTabTitle(
          workspaceId,
          selectedSessionId,
          frame.title,
          frame.titlePath,
          frame.titleCommand,
        )
      }
    }

    const flushQueuedFrames = (): void => {
      for (const frame of queuedFrames) handleFrame(frame)
      queuedFrames.length = 0
    }

    void (async () => {
      const viewport = ensureViewportRef.current()
      viewport?.reset()
      viewport?.setInputEnabled(false)
      const host = viewportHostRef.current
      const dims = viewport !== null && host !== null
        ? await waitForXtermViewportFit(() => viewport.fit(), host, ac.signal)
        : null
      if (dims !== null && !ac.signal.aborted) {
        try {
          await terminalResize(workspaceId, selectedSessionId, dims.cols, dims.rows, ac.signal)
        } catch {
          if (ac.signal.aborted) return
        }
      }
      if (ac.signal.aborted) return
      replayReady = true
      flushQueuedFrames()
    })()

    terminalStream(workspaceId, selectedSessionId, (frame) => {
      if (!replayReady) {
        queuedFrames.push(frame)
        return
      }
      handleFrame(frame)
    }, ac.signal, () => {
      if (visibleRef.current) actions.setConnecting(workspaceId, false)
      actions.setInlineError(workspaceId, undefined)
      if (!scrollbackSeen) ensureViewportRef.current()?.setInputEnabled(true)
    }, (message) => {
      if (visibleRef.current) actions.setConnecting(workspaceId, false)
      actions.setInlineError(workspaceId, message)
    })
    return () => { ac.abort() }
  }, [
    actions, selectedSessionId, streamAttempt, terminalResize, terminalStream, workspaceId,
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
    if (selectedSessionId === undefined) return
    const tab = tabRefs.current.get(selectedSessionId)
    if (typeof tab?.scrollIntoView === 'function') {
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [selectedSessionId, tabs])

  const tabCloseMenuItems = useMemo((): readonly MenuEntry[] => {
    if (tabMenu === null) return []
    const disabled = terminalTabCloseMenuState(tabs, tabMenu.anchorSessionId)
    return [
      { id: 'current', label: t('terminal.tab.closeCurrent'), disabled: disabled.closeCurrentDisabled },
      { id: 'others', label: t('terminal.tab.closeOthers'), disabled: disabled.closeOthersDisabled },
      { id: 'right', label: t('terminal.tab.closeRight'), disabled: disabled.closeRightDisabled },
      { id: 'left', label: t('terminal.tab.closeLeft'), disabled: disabled.closeLeftDisabled },
      { type: 'separator', id: 'close-sep' },
      { id: 'all', label: t('terminal.tab.closeAll'), danger: true, disabled: disabled.closeAllDisabled },
    ]
  }, [tabMenu, tabs, t])

  const activeTab = useMemo(
    () => tabs.find(tab => tab.sessionId === selectedSessionId),
    [selectedSessionId, tabs],
  )
  const addMenuDisabled = spawning

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
            <div
              key={tab.sessionId}
              ref={(element) => {
                if (element === null) tabRefs.current.delete(tab.sessionId)
                else tabRefs.current.set(tab.sessionId, element)
              }}
              role="tab"
              aria-selected={tab.sessionId === selectedSessionId}
              className={clsx(css.tab, tab.sessionId === selectedSessionId && css.tabActive)}
              onClick={() => { actions.setSelectedSession(workspaceId, tab.sessionId) }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setTabMenu({
                  anchorSessionId: tab.sessionId,
                  rect: event.currentTarget.getBoundingClientRect(),
                })
              }}
            >
              {renderTerminalTabTitle(tab)}
              {tabs.length > 1 && (
                <Tooltip
                  label={t('terminal.tab.close', { name: terminalTabDisplayTitle(tab) })}
                  side="bottom"
                  delayMs={TOOLTIP_DELAY_MS}
                >
                  <button
                    type="button"
                    className={css.tabClose}
                    aria-label={t('terminal.tab.close', { name: terminalTabDisplayTitle(tab) })}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleCloseTab(tab.sessionId)
                    }}
                  >
                    <IconCloseOutline16 size={12} />
                  </button>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
        {tabMenu !== null && (
          <Menu
            open
            portal
            compact
            align="start"
            side="bottom"
            anchor={<span aria-hidden="true" />}
            items={tabCloseMenuItems}
            onSelect={(id) => {
              handleCloseTabs(id as TerminalTabCloseScope, tabMenu.anchorSessionId)
              setTabMenu(null)
            }}
            onClose={() => { setTabMenu(null) }}
            getAnchorRect={() => tabMenu.rect}
          />
        )}
        <div className={css.tabBarActions}>
          <Menu
            open={addMenuOpen}
            onClose={() => { setAddMenuOpen(false) }}
            align="end"
            compact
            portal
            items={profileMenuItems}
            onSelect={(id) => { void spawnTab(id) }}
            anchor={(
              <button
                ref={addMenuTriggerRef}
                type="button"
                className={css.addButton}
                aria-label={t('terminal.tab.new')}
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                disabled={addMenuDisabled}
                onClick={() => { void openAddMenu() }}
              >
                <IconPlusOutline16 size={14} />
              </button>
            )}
          />
        </div>
      </div>
      {unavailableMessage !== undefined && tabs.length === 0
        ? (
          <div className={css.bodyUnavailable}>
            <div className={css.emptyCard}>
              <span className={css.emptyIcon} aria-hidden="true">
                <IconCodeOutline16 size={48} />
              </span>
              <div className={css.emptyTitle}>{t('terminal.empty.unavailable.title')}</div>
              <div className={css.emptyBody}>{unavailableMessage}</div>
              <Button
                variant="primary"
                size="sm"
                className={css.emptyRetry}
                onClick={retryUnavailable}
              >
                {t('terminal.error.retry')}
              </Button>
            </div>
          </div>
        )
        : (
          <>
            {inlineError !== undefined && (
              <div className={css.inlineError} role="alert">
                <span className={css.inlineErrorMessage}>{inlineError}</span>
                <button type="button" className={css.inlineErrorRetry} onClick={retryInline}>
                  {t('terminal.error.retry')}
                </button>
              </div>
            )}
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
          </>
        )}
      <span className={css.hidden}>{activeTab?.title ?? ''}</span>
      <Modal
        open={pendingClose !== null}
        onClose={cancelPendingClose}
        closeLabel={t('terminal.dialog.close')}
        title={t('terminal.dialog.runningGuard.title')}
        {...pendingClose === null
          ? {}
          : { description: t('terminal.dialog.runningGuard.desc', { names: pendingClose.runningTitles.join('、') }) }}
        footer={(
          <>
            <Button variant="outline" onClick={cancelPendingClose}>
              {t('terminal.dialog.runningGuard.cancel')}
            </Button>
            <Button variant="primary" onClick={confirmPendingClose}>
              {t('terminal.dialog.runningGuard.confirm')}
            </Button>
          </>
        )}
      />
    </div>
  )
}
