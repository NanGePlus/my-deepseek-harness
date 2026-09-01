/** Embedded-browser occupant of the details column Browser tab. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Button,
  IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16,
  IconEllipsisOutline16,
  IconGlobeOutline14, IconLinkOutline16, IconLoadingOutline16, IconPlusOutline16, IconRefreshOutline16,
  Menu, type MenuEntry,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  BrowserListResult, BrowserPageMetadata, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { isBrowserTabNotFoundError, reportBrowserFailure } from './browser-failure.ts'
import {
  browserUrlHost, isExternalBrowserUrl, isLocalhostBrowserUrl, normalizeBrowserNavigateUrl,
} from './browser-navigate-url.ts'
import {
  formatBrowserZoomLabel, isDefaultBrowserZoom, stepBrowserZoom,
} from './browser-zoom.ts'
import {
  browserTabCloseMenuState,
  type BrowserTabCloseScope,
  surviveTabIdAfterClose,
  tabIdsForCloseScope,
  wouldCloseEveryBrowserTab,
} from './browser-tab-close-scope.ts'
import {
  browserWorkspaceState, createBrowserPanelStore, rowsFromBrowserList,
} from './stores.ts'
import { browserTabDisplayTitle, DEFAULT_BROWSER_TAB_URL } from './browser-tab-title.ts'
import {
  readDesktopBrowserOccupantReporter,
  reportBrowserOccupantBounds,
  subscribeDesktopEmbeddedBrowserOpen,
  openDesktopExternalUrl,
  type BrowserOccupantOverlay,
} from './browser-desktop-occupant.ts'
import { planEmbeddedBrowserOpen } from './embedded-browser-open.ts'
import css from './BrowserPanel.module.css'

/** How often the toolbox Tab bar rereads Host metadata while the segment is visible. */
const BROWSER_TAB_SYNC_MS = 1000

/** Host embedded-browser callbacks closed over `ctx.workspaces` in apply. */
export interface BrowserPanelInjected {
  /**
   * List live browser tabs for one Workspace.
   * @param workspaceId - Workspace whose browser pool is queried.
   * @param signal - aborts a superseded read.
   */
  browserList: (workspaceId: WorkspaceId, signal?: AbortSignal) => Promise<BrowserListResult>
  /**
   * Create one browser tab, optionally navigating immediately.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param url - optional initial navigation target.
   * @param signal - aborts a superseded create.
   */
  browserCreateTab: (
    workspaceId: WorkspaceId,
    url?: string,
    signal?: AbortSignal,
  ) => Promise<{ tabId: string }>
  /**
   * Close one browser tab.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param signal - aborts a superseded close.
   */
  browserCloseTab: (
    workspaceId: WorkspaceId,
    tabId: string,
    signal?: AbortSignal,
  ) => Promise<{ closed: true }>
  /**
   * Select one browser tab in the Host registry.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param signal - aborts a superseded select.
   */
  browserSelectTab: (
    workspaceId: WorkspaceId,
    tabId: string,
    signal?: AbortSignal,
  ) => Promise<{ selected: true }>
  /**
   * Navigate the active tab to one URL.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param url - navigation target.
   * @param signal - aborts a superseded navigate.
   */
  browserNavigate: (
    workspaceId: WorkspaceId,
    tabId: string,
    url: string,
    signal?: AbortSignal,
  ) => Promise<BrowserPageMetadata>
  /**
   * Navigate back in the active tab history.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param signal - aborts a superseded go-back.
   */
  browserGoBack: (
    workspaceId: WorkspaceId,
    tabId: string,
    signal?: AbortSignal,
  ) => Promise<BrowserPageMetadata>
  /**
   * Navigate forward in the active tab history.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param signal - aborts a superseded go-forward.
   */
  browserGoForward: (
    workspaceId: WorkspaceId,
    tabId: string,
    signal?: AbortSignal,
  ) => Promise<BrowserPageMetadata>
  /**
   * Reload the active tab.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param hard - when true, bypass cache.
   * @param signal - aborts a superseded reload.
   */
  browserReload: (
    workspaceId: WorkspaceId,
    tabId: string,
    hard?: boolean,
    signal?: AbortSignal,
  ) => Promise<BrowserPageMetadata>
  /**
   * Raise the headed Chromium window for one tab.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param signal - aborts a superseded raise.
   */
  browserShowWindow: (
    workspaceId: WorkspaceId,
    tabId: string,
    signal?: AbortSignal,
  ) => Promise<{ shown: true }>
}

/** Props for the embedded browser panel. */
export type BrowserPanelProps =
  & PropsRuntime<'conversation.details.browser'>
  & PropsLocale<'browserPanel'>
  & PropsStore<ReturnType<typeof createBrowserPanelStore>>
  & BrowserPanelInjected

/**
 * Embedded browser body: workspace-bound tabs, navigation chrome, and native-window handoff.
 * @param props - root runtime share, locale, workspace-partitioned store, and Host callbacks.
 * @returns the embedded browser surface.
 */
export function BrowserPanel({
  t, visible, revealBrowserSegment, useSessions, useWorkspaces, useStore, actions,
  browserList, browserCreateTab, browserCloseTab, browserSelectTab,
  browserNavigate, browserGoBack, browserGoForward, browserReload,
  browserShowWindow,
}: BrowserPanelProps) {
  const currentSessionId = useSessions(state => state.current)
  const workspace = useWorkspaces(state =>
    state.items.find(item => currentSessionId !== undefined && item.sessionIds.includes(currentSessionId)),
  )
  const workspaceId = workspace?.workspaceId
  const tabs = useStore(state => workspaceId === undefined
    ? []
    : browserWorkspaceState(state, workspaceId).tabs)
  const selectedTabId = useStore(state => workspaceId === undefined
    ? undefined
    : browserWorkspaceState(state, workspaceId).selectedTabId)
  const zoom = useStore(state => workspaceId === undefined
    ? 1
    : browserWorkspaceState(state, workspaceId).zoom)
  const connecting = useStore(state => workspaceId === undefined
    ? false
    : browserWorkspaceState(state, workspaceId).connecting)
  const creating = useStore(state => workspaceId === undefined
    ? false
    : browserWorkspaceState(state, workspaceId).creating)
  const inlineError = useStore(state => workspaceId === undefined
    ? undefined
    : browserWorkspaceState(state, workspaceId).inlineError)
  const browserUnavailable = useStore(state => workspaceId === undefined
    ? undefined
    : browserWorkspaceState(state, workspaceId).browserUnavailable)
  const navError = useStore(state => workspaceId === undefined
    ? undefined
    : browserWorkspaceState(state, workspaceId).navError)
  const externalInfo = useStore(state => workspaceId === undefined
    ? undefined
    : browserWorkspaceState(state, workspaceId).externalInfo)
  const seenExternalHosts = useStore(state => workspaceId === undefined
    ? []
    : browserWorkspaceState(state, workspaceId).seenExternalHosts)
  const deferAutoCreate = useStore(state => workspaceId === undefined
    ? false
    : browserWorkspaceState(state, workspaceId).deferAutoCreate)
  const wasVisibleRef = useRef(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const selectedTabIdRef = useRef(selectedTabId)
  selectedTabIdRef.current = selectedTabId
  const creatingRef = useRef(false)
  const [hostTabsReady, setHostTabsReady] = useState(false)
  const [addressDraft, setAddressDraft] = useState('')
  const [revealAttempt, setRevealAttempt] = useState(0)
  const [navigating, setNavigating] = useState(false)
  const [hardReloading, setHardReloading] = useState(false)
  const [tabMenu, setTabMenu] = useState<{ anchorTabId: string; rect: DOMRect } | null>(null)
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false)
  const [chromeMenuOverlay, setChromeMenuOverlay] = useState<BrowserOccupantOverlay | null>(null)
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0)
  const overflowButtonRef = useRef<HTMLButtonElement>(null)
  const navRetryRef = useRef<(() => void) | null>(null)
  const pendingNavigateUrlRef = useRef<string | undefined>(undefined)
  const pendingEmbeddedUrlRef = useRef<string | undefined>(undefined)
  const occupantRef = useRef<HTMLDivElement>(null)
  const desktopReporter = useMemo(() => readDesktopBrowserOccupantReporter(), [])
  const isDesktopOccupant = desktopReporter !== undefined

  const activeTab = useMemo(
    () => tabs.find(tab => tab.tabId === selectedTabId),
    [selectedTabId, tabs],
  )
  const canGoBack = activeTab?.canGoBack ?? false
  const canGoForward = activeTab?.canGoForward ?? false
  const externalUrl = activeTab !== undefined && isExternalBrowserUrl(activeTab.url)
    ? activeTab.url
    : undefined

  useEffect(() => {
    setAddressDraft(activeTab?.url ?? '')
  }, [activeTab?.tabId, activeTab?.url])

  const focusAddressBar = useCallback(() => {
    addressInputRef.current?.focus()
    addressInputRef.current?.select()
  }, [])

  const noteExternalVisit = useCallback((url: string) => {
    /* v8 ignore next -- external-site info only runs while a bound Workspace tab is active. */
    if (workspaceId === undefined) return
    if (isLocalhostBrowserUrl(url)) {
      actions.setExternalInfo(workspaceId, undefined)
      return
    }
    const host = browserUrlHost(url)
    /* v8 ignore next -- successful navigation always yields a parseable http(s) URL. */
    if (host === undefined) return
    if (seenExternalHosts.includes(host)) {
      actions.setExternalInfo(workspaceId, undefined)
      return
    }
    actions.markExternalHostSeen(workspaceId, host)
    actions.setExternalInfo(workspaceId, t('browser.info.external'))
  }, [actions, seenExternalHosts, t, workspaceId])

  const recreateHostTabsFromStore = useCallback(async (signal?: AbortSignal): Promise<string | undefined> => {
    if (workspaceId === undefined) return undefined
    const persisted = tabsRef.current
    if (persisted.length === 0) return undefined
    const priorSelectedIndex = persisted.findIndex(tab => tab.tabId === selectedTabIdRef.current)
    for (const row of persisted) {
      const url = row.url === '' ? DEFAULT_BROWSER_TAB_URL : row.url
      await browserCreateTab(workspaceId, url, signal)
      /* v8 ignore next -- superseded recreate calls abort before settlement. */
      if (signal?.aborted) return undefined
    }
    const listed = await browserList(workspaceId, signal)
    /* v8 ignore next -- superseded recreate calls abort before settlement. */
    if (signal?.aborted) return undefined
    const mapped = rowsFromBrowserList(listed.tabs)
    let selected = mapped.selectedTabId
    const hostTab = listed.tabs[priorSelectedIndex]
    if (hostTab !== undefined) {
      selected = hostTab.tabId
      if (selected !== mapped.selectedTabId) {
        await browserSelectTab(workspaceId, selected, signal)
      }
    }
    actions.setWorkspaceTabs(workspaceId, mapped.rows, selected)
    return selected
  }, [actions, browserCreateTab, browserList, browserSelectTab, workspaceId])

  const createBlankTab = useCallback(async (focusAddress = false) => {
    /* v8 ignore next -- coalesces duplicate create requests while one tab open is in flight. */
    if (workspaceId === undefined || creatingRef.current) return
    const ac = new AbortController()
    try {
      creatingRef.current = true
      actions.setCreating(workspaceId, true)
      actions.setInlineError(workspaceId, undefined)
      actions.setBrowserUnavailable(workspaceId, undefined)
      const listed = await browserList(workspaceId, ac.signal)
      /* v8 ignore next -- superseded create calls abort before settlement. */
      if (ac.signal.aborted) return
      if (listed.tabs.length === 0 && tabsRef.current.length > 0) {
        await recreateHostTabsFromStore(ac.signal)
        /* v8 ignore next -- superseded create calls abort before settlement. */
        if (ac.signal.aborted) return
      }
      const created = await browserCreateTab(workspaceId, DEFAULT_BROWSER_TAB_URL, ac.signal)
      /* v8 ignore next -- superseded create calls abort before settlement. */
      if (ac.signal.aborted) return
      actions.upsertTab(workspaceId, {
        tabId: created.tabId,
        url: DEFAULT_BROWSER_TAB_URL,
        title: '',
        canGoBack: false,
        canGoForward: false,
      })
      actions.setSelectedTab(workspaceId, created.tabId)
      if (focusAddress) focusAddressBar()
    } catch (error: unknown) {
      /* v8 ignore next -- superseded create calls abort before settlement. */
      if (ac.signal.aborted) return
      reportBrowserFailure(actions, workspaceId, error)
    } finally {
      /* v8 ignore next -- aborted creates leave creating state to the replacement call. */
      if (!ac.signal.aborted) actions.setCreating(workspaceId, false)
      creatingRef.current = false
    }
  }, [actions, browserCreateTab, browserList, focusAddressBar, recreateHostTabsFromStore, workspaceId])

  const recoverMissingHostTab = useCallback(async (): Promise<string | undefined> => {
    if (workspaceId === undefined) return undefined
    const listed = await browserList(workspaceId)
    if (listed.tabs.length > 0) {
      const mapped = rowsFromBrowserList(listed.tabs)
      actions.setWorkspaceTabs(workspaceId, mapped.rows, mapped.selectedTabId)
      return mapped.selectedTabId
    }
    if (tabsRef.current.length > 0) return recreateHostTabsFromStore()
    return undefined
  }, [actions, browserList, recreateHostTabsFromStore, workspaceId])

  const runHostTabCall = useCallback(async (
    tabId: string,
    run: (liveTabId: string) => Promise<BrowserPageMetadata>,
  ): Promise<{ tabId: string; value: BrowserPageMetadata }> => {
    try {
      return { tabId, value: await run(tabId) }
    } catch (error: unknown) {
      if (!isBrowserTabNotFoundError(error)) throw error
      const recovered = await recoverMissingHostTab()
      if (recovered === undefined) throw error
      return { tabId: recovered, value: await run(recovered) }
    }
  }, [recoverMissingHostTab])

  const revealWindow = useCallback(async (tabId: string, signal?: AbortSignal) => {
    /* v8 ignore next -- reveal only runs while a bound Workspace tab is active. */
    if (workspaceId === undefined) return
    try {
      await browserShowWindow(workspaceId, tabId, signal)
    } catch (error: unknown) {
      /* v8 ignore next -- superseded reveal calls abort before settlement. */
      if (signal?.aborted) return
      if (isBrowserTabNotFoundError(error)) {
        const recovered = await recoverMissingHostTab()
        if (recovered !== undefined && !signal?.aborted) {
          await browserShowWindow(workspaceId, recovered, signal)
          return
        }
        if (recovered !== undefined) return
      }
      reportBrowserFailure(actions, workspaceId, error)
    }
  }, [actions, browserShowWindow, recoverMissingHostTab, workspaceId])

  const syncHostTabMetadata = useCallback(async (signal?: AbortSignal) => {
    /* v8 ignore next -- metadata sync only runs while a bound Workspace is mounted. */
    if (workspaceId === undefined) return
    try {
      const listed = await browserList(workspaceId, signal)
      /* v8 ignore next -- superseded list calls abort before settlement. */
      if (signal?.aborted) return
      if (listed.tabs.length === 0) return
      const mapped = rowsFromBrowserList(listed.tabs)
      actions.setWorkspaceTabs(workspaceId, mapped.rows, mapped.selectedTabId)
    } catch (error: unknown) {
      /* v8 ignore next -- superseded list calls abort before settlement. */
      if (signal?.aborted) return
      reportBrowserFailure(actions, workspaceId, error)
    }
  }, [actions, browserList, workspaceId])

  const handleNavigate = useCallback(async () => {
    /* v8 ignore next -- navigation chrome disables without a bound Workspace. */
    if (workspaceId === undefined) return
    const draft = pendingNavigateUrlRef.current ?? addressDraft
    if (!hostTabsReady) {
      pendingNavigateUrlRef.current = normalizeBrowserNavigateUrl(draft) ?? draft
      return
    }
    pendingNavigateUrlRef.current = undefined
    const tabId = selectedTabIdRef.current
    /* v8 ignore next -- address submit is ignored until a tab is selected. */
    if (tabId === undefined) return
    const url = normalizeBrowserNavigateUrl(draft)
    if (url === undefined) {
      actions.setInlineError(workspaceId, t('browser.error.invalidUrl'))
      return
    }
    const ac = new AbortController()
    try {
      setNavigating(true)
      actions.setInlineError(workspaceId, undefined)
      actions.setNavError(workspaceId, undefined)
      const { tabId: liveTabId, value: metadata } = await runHostTabCall(
        tabId,
        liveId => browserNavigate(workspaceId, liveId, url, ac.signal),
      )
      /* v8 ignore next -- superseded navigate calls abort before settlement. */
      if (ac.signal.aborted) return
      actions.updateTabMetadata(
        workspaceId,
        liveTabId,
        metadata.url,
        metadata.title,
        metadata.canGoBack,
        metadata.canGoForward,
      )
      noteExternalVisit(metadata.url)
    } catch (error: unknown) {
      /* v8 ignore next -- superseded navigate calls abort before settlement. */
      if (ac.signal.aborted) return
      navRetryRef.current = () => { void handleNavigateRef.current() }
      reportBrowserFailure(actions, workspaceId, error, 'nav')
    } finally {
      /* v8 ignore next -- aborted navigations leave navigating state to the replacement call. */
      if (!ac.signal.aborted) setNavigating(false)
    }
  }, [
    actions, addressDraft, browserNavigate, hostTabsReady, noteExternalVisit, runHostTabCall, t,
    workspaceId,
  ])

  const selectEmbeddedTab = useCallback(async (
    boundWorkspaceId: WorkspaceId,
    tabId: string,
    signal: AbortSignal,
  ) => {
    actions.setSelectedTab(boundWorkspaceId, tabId)
    await browserSelectTab(boundWorkspaceId, tabId, signal)
  }, [actions, browserSelectTab])

  const openEmbeddedSessionUrl = useCallback(async (rawUrl: string) => {
    if (workspaceId === undefined) {
      revealBrowserSegment()
      return
    }
    if (!hostTabsReady) {
      pendingEmbeddedUrlRef.current = rawUrl
      revealBrowserSegment()
      return
    }
    pendingEmbeddedUrlRef.current = undefined
    const selected = selectedTabIdRef.current === undefined
      ? undefined
      : tabsRef.current.find(tab => tab.tabId === selectedTabIdRef.current)
    const plan = planEmbeddedBrowserOpen(rawUrl, selected)
    if (plan.kind === 'none') {
      revealBrowserSegment()
      return
    }
    const ac = new AbortController()
    try {
      actions.setInlineError(workspaceId, undefined)
      actions.setNavError(workspaceId, undefined)
      if (plan.kind === 'navigate') {
        setNavigating(true)
        const { tabId: liveTabId, value: metadata } = await runHostTabCall(
          plan.tabId,
          liveId => browserNavigate(workspaceId, liveId, plan.url, ac.signal),
        )
        /* v8 ignore next -- superseded navigate calls abort before settlement. */
        if (ac.signal.aborted) return
        actions.updateTabMetadata(
          workspaceId,
          liveTabId,
          metadata.url,
          metadata.title,
          metadata.canGoBack,
          metadata.canGoForward,
        )
        noteExternalVisit(metadata.url)
        await selectEmbeddedTab(workspaceId, liveTabId, ac.signal)
        revealBrowserSegment()
        return
      }
      actions.setCreating(workspaceId, true)
      const created = await browserCreateTab(workspaceId, plan.url, ac.signal)
      /* v8 ignore next -- superseded create calls abort before settlement. */
      if (ac.signal.aborted) return
      actions.upsertTab(workspaceId, {
        tabId: created.tabId,
        url: plan.url,
        title: '',
        canGoBack: false,
        canGoForward: false,
      })
      await selectEmbeddedTab(workspaceId, created.tabId, ac.signal)
      noteExternalVisit(plan.url)
      revealBrowserSegment()
    } catch (error: unknown) {
      /* v8 ignore next -- abort means a superseded open. */
      if (ac.signal.aborted) return
      reportBrowserFailure(actions, workspaceId, error, plan.kind === 'navigate' ? 'nav' : undefined)
      revealBrowserSegment()
    } finally {
      if (!ac.signal.aborted) {
        setNavigating(false)
        actions.setCreating(workspaceId, false)
      }
    }
  }, [
    actions, browserCreateTab, browserNavigate, hostTabsReady, noteExternalVisit, revealBrowserSegment,
    runHostTabCall, selectEmbeddedTab, workspaceId,
  ])
  const openEmbeddedSessionUrlRef = useRef(openEmbeddedSessionUrl)
  openEmbeddedSessionUrlRef.current = openEmbeddedSessionUrl
  const handleNavigateRef = useRef(handleNavigate)
  handleNavigateRef.current = handleNavigate

  useEffect(() => subscribeDesktopEmbeddedBrowserOpen((url) => {
    void openEmbeddedSessionUrlRef.current(url)
  }), [])

  useEffect(() => {
    if (!hostTabsReady) return
    if (pendingNavigateUrlRef.current !== undefined) void handleNavigate()
    const embedded = pendingEmbeddedUrlRef.current
    if (embedded !== undefined) {
      pendingEmbeddedUrlRef.current = undefined
      void openEmbeddedSessionUrl(embedded)
    }
  }, [handleNavigate, hostTabsReady, openEmbeddedSessionUrl])

  const handleSelectTab = useCallback(async (tabId: string) => {
    /* v8 ignore next -- tab rows only render after a bound Workspace bootstrap. */
    if (workspaceId === undefined) return
    actions.setSelectedTab(workspaceId, tabId)
    const ac = new AbortController()
    try {
      await browserSelectTab(workspaceId, tabId, ac.signal)
    } catch (error: unknown) {
      /* v8 ignore next -- DirectoryBrowseError is expected; abort means a superseded select. */
      if (error instanceof DirectoryBrowseError || ac.signal.aborted) return
      /* v8 ignore next -- unexpected Host failures propagate to the runtime error boundary. */
      throw error
    }
  }, [actions, browserSelectTab, workspaceId])

  const handleCloseTab = useCallback(async (tabId: string) => {
    /* v8 ignore next -- the close affordance hides while only one tab remains. */
    if (workspaceId === undefined || tabsRef.current.length <= 1) return
    const ac = new AbortController()
    try {
      await browserCloseTab(workspaceId, tabId, ac.signal)
      /* v8 ignore next -- superseded close calls abort before settlement. */
      if (ac.signal.aborted) return
      actions.removeTab(workspaceId, tabId)
    } catch (error: unknown) {
      /* v8 ignore next -- abort means a superseded close. */
      if (ac.signal.aborted) return
      if (isBrowserTabNotFoundError(error)) {
        actions.removeTab(workspaceId, tabId)
        return
      }
      /* v8 ignore next -- DirectoryBrowseError is expected; other Host failures hit the boundary. */
      if (error instanceof DirectoryBrowseError) return
      /* v8 ignore next -- unexpected Host failures propagate to the runtime error boundary. */
      throw error
    }
  }, [actions, browserCloseTab, workspaceId])

  const executeCloseTabs = useCallback(async (
    tabIds: readonly string[],
    surviveTabId: string | undefined,
  ) => {
    /* v8 ignore next -- bulk close only runs while a bound Workspace is mounted. */
    if (workspaceId === undefined) return
    for (const tabId of tabIds) {
      if (tabsRef.current.length <= 1) break
      await handleCloseTab(tabId)
    }
    if (
      surviveTabId !== undefined
      && tabsRef.current.some(tab => tab.tabId === surviveTabId)
    ) {
      await handleSelectTab(surviveTabId)
    }
  }, [handleCloseTab, handleSelectTab, workspaceId])

  const requestCloseTabs = useCallback((
    tabIds: readonly string[],
    surviveTabId: string | undefined,
  ) => {
    if (wouldCloseEveryBrowserTab(tabsRef.current, tabIds)) return
    void executeCloseTabs(tabIds, surviveTabId)
  }, [executeCloseTabs])

  const handleCloseTabs = useCallback((scope: BrowserTabCloseScope, anchorTabId: string) => {
    const currentTabs = tabsRef.current
    const tabIds = tabIdsForCloseScope(currentTabs, anchorTabId, scope)
    if (tabIds.length === 0) return
    const surviveTabId = surviveTabIdAfterClose(currentTabs, anchorTabId, scope)
    requestCloseTabs(tabIds, surviveTabId)
  }, [requestCloseTabs])

  const applyPageMetadata = useCallback((tabId: string, metadata: BrowserPageMetadata) => {
    /* v8 ignore next -- metadata updates only run while a bound Workspace tab is active. */
    if (workspaceId === undefined) return
    actions.updateTabMetadata(
      workspaceId,
      tabId,
      metadata.url,
      metadata.title,
      metadata.canGoBack,
      metadata.canGoForward,
    )
  }, [actions, workspaceId])

  const openExternalBrowser = useCallback(() => {
    if (externalUrl === undefined) return
    const desktopOpen = openDesktopExternalUrl(externalUrl)
    if (desktopOpen !== undefined) {
      void desktopOpen
      return
    }
    window.open(externalUrl, '_blank', 'noopener,noreferrer')
  }, [externalUrl])

  const retryNav = useCallback(() => {
    /* v8 ignore next -- nav retry only renders while a bound Workspace tab is active. */
    if (workspaceId === undefined) return
    actions.setNavError(workspaceId, undefined)
    navRetryRef.current?.()
  }, [actions, workspaceId])

  const retryUnavailable = useCallback(() => {
    /* v8 ignore next -- unavailable retry only renders while a bound Workspace is mounted. */
    if (workspaceId === undefined) return
    actions.setBrowserUnavailable(workspaceId, undefined)
    if (tabsRef.current.length === 0) {
      setBootstrapAttempt(attempt => attempt + 1)
    } else {
      setRevealAttempt(attempt => attempt + 1)
    }
  }, [actions, workspaceId])

  const copyCurrentUrl = useCallback(() => {
    if (activeTab === undefined) return
    void navigator.clipboard?.writeText(activeTab.url)
    setOverflowMenuOpen(false)
  }, [activeTab])

  const hardReload = useCallback(() => {
    /* v8 ignore next -- hard reload disables without a selected tab. */
    if (workspaceId === undefined || selectedTabId === undefined) return
    setOverflowMenuOpen(false)
    setHardReloading(true)
    setNavigating(true)
    actions.setNavError(workspaceId, undefined)
    void (async () => {
      try {
        let tabId = selectedTabId
        const metadata = await browserReload(workspaceId, tabId, true).catch(async (error: unknown) => {
          if (!isBrowserTabNotFoundError(error)) throw error
          const recovered = await recoverMissingHostTab()
          if (recovered === undefined) throw error
          tabId = recovered
          return browserReload(workspaceId, recovered, true)
        })
        applyPageMetadata(tabId, metadata)
        noteExternalVisit(metadata.url)
      } catch (error: unknown) {
        navRetryRef.current = hardReload
        reportBrowserFailure(actions, workspaceId, error, 'nav')
      } finally {
        setNavigating(false)
        setHardReloading(false)
      }
    })()
  }, [actions, applyPageMetadata, browserReload, noteExternalVisit, recoverMissingHostTab, selectedTabId, workspaceId])

  const runHistoryNav = useCallback((
    run: (tabId: string) => Promise<BrowserPageMetadata>,
  ) => {
    const tabId = selectedTabIdRef.current
    /* v8 ignore next -- history nav buttons disable without a selected tab. */
    if (workspaceId === undefined || tabId === undefined) return
    actions.setNavError(workspaceId, undefined)
    navRetryRef.current = () => { runHistoryNav(run) }
    void runHostTabCall(tabId, run).then(({ tabId: liveTabId, value: metadata }) => {
      applyPageMetadata(liveTabId, metadata)
      noteExternalVisit(metadata.url)
    }).catch((error: unknown) => {
      reportBrowserFailure(actions, workspaceId, error, 'nav')
    })
  }, [actions, applyPageMetadata, noteExternalVisit, runHostTabCall, workspaceId])

  const runSoftReload = useCallback(() => {
    /* v8 ignore next -- reload disables without a selected tab. */
    if (workspaceId === undefined || selectedTabId === undefined) return
    setNavigating(true)
    actions.setNavError(workspaceId, undefined)
    navRetryRef.current = runSoftReload
    void (async () => {
      try {
        let tabId = selectedTabId
        const metadata = await browserReload(workspaceId, tabId).catch(async (error: unknown) => {
          if (!isBrowserTabNotFoundError(error)) throw error
          const recovered = await recoverMissingHostTab()
          if (recovered === undefined) throw error
          tabId = recovered
          return browserReload(workspaceId, recovered)
        })
        applyPageMetadata(tabId, metadata)
        noteExternalVisit(metadata.url)
      } catch (error: unknown) {
        reportBrowserFailure(actions, workspaceId, error, 'nav')
      } finally {
        setNavigating(false)
      }
    })()
  }, [actions, applyPageMetadata, browserReload, noteExternalVisit, recoverMissingHostTab, selectedTabId, workspaceId])

  const retryInline = useCallback(() => {
    /* v8 ignore next -- retry only renders while a bound Workspace tab is active. */
    if (workspaceId === undefined) return
    actions.setInlineError(workspaceId, undefined)
    setRevealAttempt(attempt => attempt + 1)
  }, [actions, workspaceId])

  useEffect(() => {
    setHostTabsReady(false)
    if (!visible || workspaceId === undefined) {
      wasVisibleRef.current = visible
      return
    }
    const reentered = !wasVisibleRef.current
    wasVisibleRef.current = visible
    if (reentered) actions.setDeferAutoCreate(workspaceId, false)
    actions.clearTransientState(workspaceId)
    if (!reentered && deferAutoCreate && tabsRef.current.length === 0) return
    const ac = new AbortController()
    void (async () => {
      try {
        const listed = await browserList(workspaceId, ac.signal)
        if (ac.signal.aborted) return
        if (listed.tabs.length > 0) {
          const mapped = rowsFromBrowserList(listed.tabs)
          actions.setWorkspaceTabs(workspaceId, mapped.rows, mapped.selectedTabId)
          setHostTabsReady(true)
          return
        }
        if (tabsRef.current.length > 0) {
          await recreateHostTabsFromStore(ac.signal)
          if (ac.signal.aborted) return
          setHostTabsReady(true)
          return
        }
        if (!reentered && deferAutoCreate) return
        await createBlankTab(true)
        if (ac.signal.aborted) return
        setHostTabsReady(true)
      } catch (error: unknown) {
        /* v8 ignore next -- bootstrap aborts when the segment hides or Workspace changes. */
        if (ac.signal.aborted) return
        setHostTabsReady(false)
        reportBrowserFailure(actions, workspaceId, error)
      }
    })()
    return () => {
      ac.abort()
      setHostTabsReady(false)
    }
  }, [
    actions, bootstrapAttempt, browserList, createBlankTab, deferAutoCreate,
    recreateHostTabsFromStore, visible, workspaceId,
  ])

  useEffect(() => {
    if (isDesktopOccupant) return
    if (!hostTabsReady || workspaceId === undefined || selectedTabId === undefined || !visible) {
      if (workspaceId !== undefined) actions.setConnecting(workspaceId, false)
      return
    }
    const ac = new AbortController()
    actions.setConnecting(workspaceId, true)
    void revealWindow(selectedTabId, ac.signal).finally(() => {
      if (!ac.signal.aborted) actions.setConnecting(workspaceId, false)
    })
    return () => { ac.abort() }
  }, [actions, hostTabsReady, isDesktopOccupant, revealAttempt, revealWindow, selectedTabId, visible, workspaceId])

  const chromeMenuOpen = overflowMenuOpen || tabMenu !== null

  useLayoutEffect(() => {
    if (!isDesktopOccupant || !chromeMenuOpen) {
      setChromeMenuOverlay(null)
      return
    }
    const readOverlay = (): void => {
      const menu = document.querySelector('[role="menu"]')
      if (!(menu instanceof HTMLElement)) return
      const rect = menu.getBoundingClientRect()
      if (rect.height <= 0) return
      setChromeMenuOverlay({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      })
    }
    readOverlay()
    const menu = document.querySelector('[role="menu"]')
    if (menu === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { readOverlay() })
    observer.observe(menu)
    return () => { observer.disconnect() }
  }, [chromeMenuOpen, isDesktopOccupant])

  useEffect(() => {
    if (!isDesktopOccupant) return
    const publish = (): void => {
      reportBrowserOccupantBounds(
        desktopReporter,
        occupantRef.current,
        visible,
        chromeMenuOverlay,
      )
    }
    if (!visible) {
      publish()
      return
    }
    publish()
    const element = occupantRef.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { publish() })
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [
    chromeMenuOverlay, desktopReporter, hostTabsReady, isDesktopOccupant,
    revealAttempt, selectedTabId, visible,
  ])

  useEffect(() => {
    if (!hostTabsReady || !visible || workspaceId === undefined) return
    const ac = new AbortController()
    const timer = window.setInterval(() => {
      void syncHostTabMetadata(ac.signal)
    }, BROWSER_TAB_SYNC_MS)
    return () => {
      ac.abort()
      window.clearInterval(timer)
    }
  }, [hostTabsReady, syncHostTabMetadata, visible, workspaceId])

  const addTabDisabled = creating || creatingRef.current
  const showPreparingOverlay = isDesktopOccupant && visible && !hostTabsReady
  const showNavOverlay = navigating && !hardReloading
  const showConnectingOverlay = !isDesktopOccupant && connecting
  const showLoadingOverlay = showPreparingOverlay || showNavOverlay || showConnectingOverlay
  const loadingMessage = showPreparingOverlay
    ? t('browser.loading.preparing')
    : showConnectingOverlay
      ? t('browser.loading.connecting')
      : undefined
  const canCloseTabs = tabs.length > 1

  const tabCloseMenuItems = useMemo((): readonly MenuEntry[] => {
    if (tabMenu === null) return []
    const disabled = browserTabCloseMenuState(tabs, tabMenu.anchorTabId)
    return [
      { id: 'current', label: t('browser.tab.closeCurrent'), disabled: disabled.closeCurrentDisabled },
      { id: 'others', label: t('browser.tab.closeOthers'), disabled: disabled.closeOthersDisabled },
      { id: 'right', label: t('browser.tab.closeRight'), disabled: disabled.closeRightDisabled },
      { id: 'left', label: t('browser.tab.closeLeft'), disabled: disabled.closeLeftDisabled },
      { type: 'separator', id: 'close-sep' },
      { id: 'all', label: t('browser.tab.closeAll'), danger: true, disabled: disabled.closeAllDisabled },
    ]
  }, [tabMenu, tabs, t])

  const overflowItems = useMemo((): readonly MenuEntry[] => [
    {
      id: 'hard-reload',
      label: t('browser.nav.hardReload'),
      disabled: selectedTabId === undefined || browserUnavailable !== undefined,
    },
    {
      id: 'copy-url',
      label: t('browser.nav.copyUrl'),
      disabled: externalUrl === undefined,
    },
  ], [browserUnavailable, externalUrl, selectedTabId, t])

  const overflowFooter = useMemo((): readonly MenuEntry[] => [
    { type: 'label', id: 'zoom-label', text: 'Zoom' },
    { id: 'zoom-out', label: '−', disabled: stepBrowserZoom(zoom, -1) === zoom },
    { type: 'label', id: 'zoom-value', text: formatBrowserZoomLabel(zoom) },
    { id: 'zoom-in', label: '+', disabled: stepBrowserZoom(zoom, 1) === zoom },
    {
      id: 'zoom-reset',
      label: t('browser.nav.zoomReset'),
      disabled: isDefaultBrowserZoom(zoom),
    },
  ], [t, zoom])

  const handleOverflowSelect = useCallback((id: string) => {
    if (id === 'hard-reload') {
      hardReload()
      return
    }
    if (id === 'copy-url') {
      copyCurrentUrl()
      return
    }
    /* v8 ignore next -- zoom controls only render while a bound Workspace is mounted. */
    if (workspaceId === undefined) return
    if (id === 'zoom-out') {
      actions.setZoom(workspaceId, stepBrowserZoom(zoom, -1))
      return
    }
    if (id === 'zoom-in') {
      actions.setZoom(workspaceId, stepBrowserZoom(zoom, 1))
      return
    }
    if (id === 'zoom-reset') actions.setZoom(workspaceId, 1)
  }, [actions, copyCurrentUrl, hardReload, workspaceId, zoom])

  if (workspaceId === undefined) {
    return (
      <div className={css.root} data-surface="embedded-browser">
        <div className={css.overlay}>
          <div className={css.emptyCard}>
            <span className={css.emptyIcon} aria-hidden="true">
              <IconGlobeOutline14 size={48} />
            </span>
            <div className={css.emptyTitle}>{t('browser.empty.unbound.title')}</div>
            <div className={css.emptyBody}>{t('browser.empty.unbound.body')}</div>
          </div>
        </div>
      </div>
    )
  }

  if (browserUnavailable !== undefined && tabs.length === 0) {
    return (
      <div className={css.root} data-surface="embedded-browser">
        <div className={css.overlay}>
          <div className={css.emptyCard}>
            <span className={css.emptyIcon} aria-hidden="true">
              <IconGlobeOutline14 size={48} />
            </span>
            <div className={css.emptyTitle}>{t('browser.empty.unavailable.title')}</div>
            <div className={css.emptyBody}>{browserUnavailable}</div>
            <Button variant="primary" size="sm" className={css.emptyRetry} onClick={retryUnavailable}>
              {t('browser.error.retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={css.root} data-surface="embedded-browser">
      <div className={css.tabBar}>
        <div className={css.tablist} role="tablist" aria-label={t('browser.tab.aria')}>
          {tabs.map(tab => (
            <div
              key={tab.tabId}
              role="tab"
              aria-selected={tab.tabId === selectedTabId}
              className={clsx(css.tab, tab.tabId === selectedTabId && css.tabActive)}
              onClick={() => { void handleSelectTab(tab.tabId) }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setTabMenu({
                  anchorTabId: tab.tabId,
                  rect: event.currentTarget.getBoundingClientRect(),
                })
              }}
            >
              <span className={css.tabTitle}>{browserTabDisplayTitle(tab)}</span>
              {canCloseTabs && (
                <button
                  type="button"
                  className={css.tabClose}
                  aria-label={t('browser.tab.close')}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleCloseTab(tab.tabId)
                  }}
                >
                  <IconCloseOutline16 size={12} />
                </button>
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
              handleCloseTabs(id as BrowserTabCloseScope, tabMenu.anchorTabId)
              setTabMenu(null)
            }}
            onClose={() => { setTabMenu(null) }}
            getAnchorRect={() => tabMenu.rect}
          />
        )}
        <div className={css.tabBarActions}>
          <Tooltip label={t('browser.tab.new')} side="bottom" delayMs={500}>
            <button
              type="button"
              className={css.addButton}
              aria-label={t('browser.tab.new')}
              disabled={addTabDisabled}
              onClick={() => { void createBlankTab(true) }}
            >
              <IconPlusOutline16 size={14} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className={css.navBar}>
        <Tooltip label={t('browser.nav.back')} side="bottom" delayMs={500}>
          <button
            type="button"
            className={css.navButton}
            aria-label={t('browser.nav.back')}
            disabled={selectedTabId === undefined || !canGoBack}
            onClick={() => {
              /* v8 ignore next -- nav buttons disable without a selected tab. */
              if (workspaceId === undefined || selectedTabId === undefined) return
              runHistoryNav(id => browserGoBack(workspaceId, id))
            }}
          >
            <IconChevronLeftOutline14 size={14} />
          </button>
        </Tooltip>
        <Tooltip label={t('browser.nav.forward')} side="bottom" delayMs={500}>
          <button
            type="button"
            className={css.navButton}
            aria-label={t('browser.nav.forward')}
            disabled={selectedTabId === undefined || !canGoForward}
            onClick={() => {
              /* v8 ignore next -- nav buttons disable without a selected tab. */
              if (workspaceId === undefined || selectedTabId === undefined) return
              runHistoryNav(id => browserGoForward(workspaceId, id))
            }}
          >
            <IconChevronRightOutline14 size={14} />
          </button>
        </Tooltip>
        <Tooltip label={t('browser.nav.reload')} side="bottom" delayMs={500}>
          <button
            type="button"
            className={css.navButton}
            aria-label={t('browser.nav.reload')}
            disabled={selectedTabId === undefined || navigating || !hostTabsReady}
            onClick={() => { runSoftReload() }}
          >
            <span className={navigating ? css.spinner : undefined} aria-hidden="true">
              <IconRefreshOutline16 size={14} />
            </span>
          </button>
        </Tooltip>
        <input
          ref={addressInputRef}
          type="text"
          className={css.addressInput}
          aria-label={t('browser.nav.address')}
          value={addressDraft}
          onChange={(event) => { setAddressDraft(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleNavigate()
            }
          }}
        />
        <Tooltip label={t('browser.nav.openExternal')} side="bottom" delayMs={500}>
          <button
            type="button"
            className={css.navButton}
            aria-label={t('browser.nav.openExternal')}
            disabled={externalUrl === undefined}
            onClick={openExternalBrowser}
          >
            <IconLinkOutline16 size={14} />
          </button>
        </Tooltip>
        <Menu
          open={overflowMenuOpen}
          portal
          compact
          align="end"
          anchor={(
            <Tooltip label={t('browser.nav.overflow')} side="bottom" delayMs={500}>
              <button
                ref={overflowButtonRef}
                type="button"
                className={css.navButton}
                aria-label={t('browser.nav.overflow')}
                aria-haspopup="menu"
                aria-expanded={overflowMenuOpen}
                onClick={() => { setOverflowMenuOpen(open => !open) }}
              >
                <IconEllipsisOutline16 size={14} />
              </button>
            </Tooltip>
          )}
          items={overflowItems}
          footer={overflowFooter}
          onSelect={handleOverflowSelect}
          onClose={() => { setOverflowMenuOpen(false) }}
          getAnchorRect={() => overflowButtonRef.current?.getBoundingClientRect() ?? null}
        />
      </div>
      {externalInfo !== undefined && (
        <div className={css.inlineInfo} role="status">
          {externalInfo}
        </div>
      )}
      {navError !== undefined && (
        <div className={css.inlineError} role="alert">
          <span className={css.inlineErrorMessage}>{navError}</span>
          <button type="button" className={css.inlineErrorRetry} onClick={retryNav}>
            {t('browser.error.retry')}
          </button>
        </div>
      )}
      {inlineError !== undefined && (
        <div className={css.inlineError} role="alert">
          <span className={css.inlineErrorMessage}>{inlineError}</span>
          <button type="button" className={css.inlineErrorRetry} onClick={retryInline}>
            {t('browser.error.retry')}
          </button>
        </div>
      )}
      <div className={css.body}>
        {isDesktopOccupant
          ? (
            <div
              id="browser-occupant"
              ref={occupantRef}
              className={css.desktopOccupant}
              role="tabpanel"
              aria-label={t('browser.native.aria')}
              aria-busy={showLoadingOverlay}
            />
          )
          : (
            <div
              className={css.nativePane}
              role="tabpanel"
              aria-label={t('browser.native.aria')}
              aria-busy={showLoadingOverlay}
            >
              <div className={css.emptyCard}>
                <span className={css.emptyIcon} aria-hidden="true">
                  <IconGlobeOutline14 size={48} />
                </span>
                <div className={css.emptyTitle}>{t('browser.native.title')}</div>
                <div className={css.emptyBody}>{t('browser.native.body')}</div>
                <Button
                  variant="primary"
                  size="sm"
                  className={css.emptyRetry}
                  disabled={selectedTabId === undefined || browserUnavailable !== undefined}
                  onClick={() => {
                    /* v8 ignore next -- the button disables without a selected tab. */
                    if (selectedTabId === undefined) return
                    setRevealAttempt(attempt => attempt + 1)
                  }}
                >
                  {t('browser.native.show')}
                </Button>
              </div>
            </div>
          )}
        {browserUnavailable !== undefined && (
          <div className={css.unavailableOverlay}>
            <div className={css.emptyCard}>
              <span className={css.emptyIcon} aria-hidden="true">
                <IconGlobeOutline14 size={48} />
              </span>
              <div className={css.emptyTitle}>{t('browser.empty.unavailable.title')}</div>
              <div className={css.emptyBody}>{browserUnavailable}</div>
              <Button variant="primary" size="sm" className={css.emptyRetry} onClick={retryUnavailable}>
                {t('browser.error.retry')}
              </Button>
            </div>
          </div>
        )}
        {navError !== undefined && browserUnavailable === undefined && (
          <div className={css.navFailureOverlay} role="alert">
            <span className={css.navFailureIcon} aria-hidden="true">
              <IconGlobeOutline14 size={48} />
            </span>
            <div>{t('browser.empty.navFailure')}</div>
          </div>
        )}
        {showLoadingOverlay
          ? (
            <div className={css.loadingOverlay}>
              <span className={css.spinner} aria-hidden="true">
                <IconLoadingOutline16 size={24} />
              </span>
              {loadingMessage !== undefined && (
                <div className={css.loadingCopy}>{loadingMessage}</div>
              )}
            </div>
          )
          : null}
      </div>
      <span className={css.hidden}>{activeTab?.title ?? ''}</span>
    </div>
  )
}
