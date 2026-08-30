/** Embedded-browser occupant of the details column Browser tab. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16,
  IconGlobeOutline14, IconLoadingOutline16, IconPlusOutline16, IconRefreshOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  BrowserListResult, BrowserPageMetadata, BrowserScreencastFrame, WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { reportBrowserFailure } from './browser-failure.ts'
import {
  browserWorkspaceState, createBrowserPanelStore, rowsFromBrowserList,
} from './stores.ts'
import { browserTabDisplayTitle, DEFAULT_BROWSER_TAB_URL } from './browser-tab-title.ts'
import { createScreencastViewport, type ScreencastViewportHandle } from './screencast-viewport.ts'
import {
  createViewportResizeDebouncer, readViewportContentSize,
} from './viewport-resize-debounce.ts'
import css from './BrowserPanel.module.css'

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
   * Resize the Host viewport for screencast capture.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param width - viewport width in CSS pixels.
   * @param height - viewport height in CSS pixels.
   * @param signal - aborts a superseded resize.
   */
  browserResizeViewport: (
    workspaceId: WorkspaceId,
    tabId: string,
    width: number,
    height: number,
    signal?: AbortSignal,
  ) => Promise<{ resized: true }>
  /**
   * Forward one pointer event to the Host page.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param event - pointer payload.
   * @param signal - aborts a superseded send.
   */
  browserSendPointer: (
    workspaceId: WorkspaceId,
    tabId: string,
    event: {
      type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
      x: number
      y: number
      button?: 'left' | 'right' | 'middle'
    },
    signal?: AbortSignal,
  ) => Promise<{ sent: true }>
  /**
   * Forward one keyboard event to the Host page.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param event - keyboard payload.
   * @param signal - aborts a superseded send.
   */
  browserSendKeyboard: (
    workspaceId: WorkspaceId,
    tabId: string,
    event: { type: 'keyDown' | 'keyUp' | 'char'; key?: string; text?: string },
    signal?: AbortSignal,
  ) => Promise<{ sent: true }>
  /**
   * Subscribe to JPEG screencast frames for one tab.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param onFrame - invoked once per Host SSE frame.
   * @param signal - aborts the stream.
   * @param onOpen - invoked once response headers are readable.
   */
  browserWatchScreencast: (
    workspaceId: WorkspaceId,
    tabId: string,
    onFrame: (frame: BrowserScreencastFrame) => void,
    signal?: AbortSignal,
    onOpen?: () => void,
    onError?: (message: string) => void,
  ) => void
}

/** Props for the embedded browser panel. */
export type BrowserPanelProps =
  & PropsRuntime<'conversation.details.browser'>
  & PropsLocale<'browserPanel'>
  & PropsStore<ReturnType<typeof createBrowserPanelStore>>
  & BrowserPanelInjected

/**
 * Embedded browser body: workspace-bound tabs, navigation chrome, and screencast canvas.
 * @param props - root runtime share, locale, workspace-partitioned store, and Host callbacks.
 * @returns the embedded browser surface.
 */
export function BrowserPanel({
  t, visible, useSessions, useWorkspaces, useStore, actions,
  browserList, browserCreateTab, browserCloseTab, browserSelectTab,
  browserNavigate, browserGoBack, browserGoForward, browserReload,
  browserResizeViewport, browserSendPointer, browserSendKeyboard, browserWatchScreencast,
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
  const deferAutoCreate = useStore(state => workspaceId === undefined
    ? false
    : browserWorkspaceState(state, workspaceId).deferAutoCreate)
  const wasVisibleRef = useRef(false)
  const viewportHostRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<ScreencastViewportHandle | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const creatingRef = useRef(false)
  const [addressDraft, setAddressDraft] = useState('')
  const [streamAttempt, setStreamAttempt] = useState(0)
  const [navigating, setNavigating] = useState(false)
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  const activeTab = useMemo(
    () => tabs.find(tab => tab.tabId === selectedTabId),
    [selectedTabId, tabs],
  )

  useEffect(() => {
    setAddressDraft(activeTab?.url ?? '')
  }, [activeTab?.tabId, activeTab?.url])

  const ensureViewport = useCallback((): ScreencastViewportHandle | null => {
    if (workspaceId === undefined || selectedTabId === undefined) return null
    const wid = workspaceId
    const tabId = selectedTabId
    if (viewportRef.current !== null) {
      viewportRef.current.setZoom(zoom)
      return viewportRef.current
    }
    const host = viewportHostRef.current
    if (host === null || host.clientWidth === 0) return null
    const viewport = createScreencastViewport({
      zoom,
      onPointer: (event) => {
        void browserSendPointer(wid, tabId, event).catch((error: unknown) => {
          reportBrowserFailure(actions, wid, error)
        })
      },
      onKeyboard: (event) => {
        void browserSendKeyboard(wid, tabId, event).catch((error: unknown) => {
          reportBrowserFailure(actions, wid, error)
        })
      },
    })
    viewport.attach(host)
    viewportRef.current = viewport
    return viewport
  }, [actions, browserSendKeyboard, browserSendPointer, selectedTabId, workspaceId, zoom])

  const ensureViewportRef = useRef(ensureViewport)
  ensureViewportRef.current = ensureViewport

  const focusAddressBar = useCallback(() => {
    addressInputRef.current?.focus()
    addressInputRef.current?.select()
  }, [])

  const syncViewportSize = useCallback(async (signal?: AbortSignal) => {
    /* v8 ignore next 2 -- only runs while a bound Workspace tab is mounted. */
    if (workspaceId === undefined || selectedTabId === undefined) return
    const host = viewportHostRef.current
    /* v8 ignore next -- tabpanel ref is committed before resize sync runs. */
    if (host === null) return
    const size = readViewportContentSize(host)
    /* v8 ignore next -- zero-sized hosts skip resize until layout settles. */
    if (size === null) return
    try {
      await browserResizeViewport(workspaceId, selectedTabId, size.width, size.height, signal)
    } catch (error: unknown) {
      /* v8 ignore next -- superseded resize calls abort before settlement. */
      if (signal?.aborted) return
      reportBrowserFailure(actions, workspaceId, error)
    }
  }, [actions, browserResizeViewport, selectedTabId, workspaceId])

  const createBlankTab = useCallback(async (focusAddress = false) => {
    /* v8 ignore next -- coalesces duplicate create requests while one tab open is in flight. */
    if (workspaceId === undefined || creatingRef.current) return
    const ac = new AbortController()
    try {
      creatingRef.current = true
      actions.setCreating(workspaceId, true)
      actions.setInlineError(workspaceId, undefined)
      const created = await browserCreateTab(workspaceId, DEFAULT_BROWSER_TAB_URL, ac.signal)
      /* v8 ignore next -- superseded create calls abort before settlement. */
      if (ac.signal.aborted) return
      actions.upsertTab(workspaceId, {
        tabId: created.tabId,
        url: DEFAULT_BROWSER_TAB_URL,
        title: '',
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
  }, [actions, browserCreateTab, focusAddressBar, workspaceId])

  const handleNavigate = useCallback(async () => {
    /* v8 ignore next 2 -- navigation chrome disables without a bound tab or empty URL. */
    if (workspaceId === undefined || selectedTabId === undefined) return
    const url = addressDraft.trim()
    if (url === '') return
    const ac = new AbortController()
    try {
      setNavigating(true)
      actions.setInlineError(workspaceId, undefined)
      const metadata = await browserNavigate(workspaceId, selectedTabId, url, ac.signal)
      /* v8 ignore next -- superseded navigate calls abort before settlement. */
      if (ac.signal.aborted) return
      actions.updateTabMetadata(workspaceId, selectedTabId, metadata.url, metadata.title)
    } catch (error: unknown) {
      /* v8 ignore next -- superseded navigate calls abort before settlement. */
      if (ac.signal.aborted) return
      reportBrowserFailure(actions, workspaceId, error)
    } finally {
      /* v8 ignore next -- aborted navigations leave navigating state to the replacement call. */
      if (!ac.signal.aborted) setNavigating(false)
    }
  }, [actions, addressDraft, browserNavigate, selectedTabId, workspaceId])

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
      /* v8 ignore next -- DirectoryBrowseError is expected; abort means a superseded close. */
      if (error instanceof DirectoryBrowseError || ac.signal.aborted) return
      /* v8 ignore next -- unexpected Host failures propagate to the runtime error boundary. */
      throw error
    }
  }, [actions, browserCloseTab, workspaceId])

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

  const retryInline = useCallback(() => {
    /* v8 ignore next -- retry only renders while a bound Workspace tab is active. */
    if (workspaceId === undefined) return
    actions.setInlineError(workspaceId, undefined)
    setStreamAttempt(attempt => attempt + 1)
  }, [actions, workspaceId])

  useEffect(() => {
    viewportRef.current?.dispose()
    viewportRef.current = null
  }, [selectedTabId, workspaceId])

  useEffect(() => {
    if (!visible) return
    ensureViewport()
  }, [ensureViewport, visible, zoom])

  useEffect(() => {
    if (!visible || workspaceId === undefined) {
      wasVisibleRef.current = visible
      return
    }
    const reentered = !wasVisibleRef.current
    wasVisibleRef.current = visible
    if (reentered) actions.setDeferAutoCreate(workspaceId, false)
    if (tabs.length > 0) return
    if (!reentered && deferAutoCreate) return
    const ac = new AbortController()
    void (async () => {
      try {
        const listed = await browserList(workspaceId, ac.signal)
        if (ac.signal.aborted) return
        if (listed.tabs.length > 0) {
          const mapped = rowsFromBrowserList(listed.tabs)
          actions.setWorkspaceTabs(workspaceId, mapped.rows, mapped.selectedTabId)
          return
        }
        await createBlankTab(true)
      } catch (error: unknown) {
        /* v8 ignore next -- bootstrap aborts when the segment hides or Workspace changes. */
        if (ac.signal.aborted) return
        reportBrowserFailure(actions, workspaceId, error)
      }
    })()
    return () => { ac.abort() }
  }, [
    actions, browserList, createBlankTab, deferAutoCreate, tabs.length, visible, workspaceId,
  ])

  useEffect(() => {
    if (workspaceId === undefined || selectedTabId === undefined || !visible) {
      streamAbortRef.current?.abort()
      if (workspaceId !== undefined) actions.setConnecting(workspaceId, false)
      return
    }
    streamAbortRef.current?.abort()
    const ac = new AbortController()
    streamAbortRef.current = ac
    actions.setConnecting(workspaceId, true)
    let frameSeen = false

    void syncViewportSize(ac.signal)

    browserWatchScreencast(workspaceId, selectedTabId, (frame) => {
      if (frame.type === 'stream/error') {
        actions.setInlineError(workspaceId, frame.error.message)
        actions.setConnecting(workspaceId, false)
        return
      }
      frameSeen = true
      ensureViewportRef.current()?.setFrame({
        data: frame.data,
        width: frame.width,
        height: frame.height,
      })
      /* v8 ignore next -- stream teardown clears connecting when the segment hides. */
      if (visibleRef.current) actions.setConnecting(workspaceId, false)
    }, ac.signal, () => {
      /* v8 ignore next -- stream teardown clears connecting when the segment hides. */
      if (visibleRef.current) actions.setConnecting(workspaceId, false)
      actions.setInlineError(workspaceId, undefined)
      /* v8 ignore next -- only clears a painted frame after the viewport host exists. */
      if (!frameSeen) ensureViewportRef.current()?.setFrame(null)
    }, (message) => {
      /* v8 ignore next -- stream teardown clears connecting when the segment hides. */
      if (visibleRef.current) actions.setConnecting(workspaceId, false)
      actions.setInlineError(workspaceId, message)
    })
    return () => { ac.abort() }
  }, [
    actions, browserWatchScreencast, selectedTabId, streamAttempt, syncViewportSize, visible, workspaceId,
  ])

  useEffect(() => {
    if (!visible || workspaceId === undefined || selectedTabId === undefined) return
    /* v8 ignore next -- ResizeObserver is polyfilled in jsdom tests and always present in web builds. */
    if (typeof ResizeObserver === 'undefined') return
    const host = viewportHostRef.current
    /* v8 ignore next -- the tabpanel ref is committed before this layout effect runs. */
    if (host === null) return
    const debouncer = createViewportResizeDebouncer(() => {
      void syncViewportSize()
    })
    const observer = new ResizeObserver(() => {
      if (host.clientWidth === 0) return
      ensureViewportRef.current?.()
      debouncer.arm()
    })
    observer.observe(host)
    debouncer.arm()
    return () => {
      observer.disconnect()
      debouncer.dispose()
    }
  }, [selectedTabId, syncViewportSize, visible, workspaceId])

  useEffect(() => () => {
    streamAbortRef.current?.abort()
    viewportRef.current?.dispose()
    viewportRef.current = null
  }, [])

  const addTabDisabled = creating || creatingRef.current
  const showLoading = connecting || navigating
  const canCloseTabs = tabs.length > 1

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
        <div className={css.tabBarActions}>
          <Tooltip label={t('browser.tab.new')} delayMs={500}>
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
        <Tooltip label={t('browser.nav.back')} delayMs={500}>
          <button
            type="button"
            className={css.navButton}
            aria-label={t('browser.nav.back')}
            disabled={selectedTabId === undefined}
            onClick={() => {
              /* v8 ignore next -- nav buttons disable without a selected tab. */
              if (workspaceId === undefined || selectedTabId === undefined) return
              void browserGoBack(workspaceId, selectedTabId).then((metadata) => {
                actions.updateTabMetadata(workspaceId, selectedTabId, metadata.url, metadata.title)
              }).catch((error: unknown) => {
                reportBrowserFailure(actions, workspaceId, error)
              })
            }}
          >
            <IconChevronLeftOutline14 size={14} />
          </button>
        </Tooltip>
        <Tooltip label={t('browser.nav.forward')} delayMs={500}>
          <button
            type="button"
            className={css.navButton}
            aria-label={t('browser.nav.forward')}
            disabled={selectedTabId === undefined}
            onClick={() => {
              /* v8 ignore next -- nav buttons disable without a selected tab. */
              if (workspaceId === undefined || selectedTabId === undefined) return
              void browserGoForward(workspaceId, selectedTabId).then((metadata) => {
                actions.updateTabMetadata(workspaceId, selectedTabId, metadata.url, metadata.title)
              }).catch((error: unknown) => {
                reportBrowserFailure(actions, workspaceId, error)
              })
            }}
          >
            <IconChevronRightOutline14 size={14} />
          </button>
        </Tooltip>
        <Tooltip label={t('browser.nav.reload')} delayMs={500}>
          <button
            type="button"
            className={css.navButton}
            aria-label={t('browser.nav.reload')}
            disabled={selectedTabId === undefined || navigating}
            onClick={() => {
              /* v8 ignore next -- reload disables without a selected tab. */
              if (workspaceId === undefined || selectedTabId === undefined) return
              setNavigating(true)
              void browserReload(workspaceId, selectedTabId).then((metadata) => {
                actions.updateTabMetadata(workspaceId, selectedTabId, metadata.url, metadata.title)
              }).catch((error: unknown) => {
                reportBrowserFailure(actions, workspaceId, error)
              }).finally(() => { setNavigating(false) })
            }}
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
      </div>
      {inlineError !== undefined && (
        <div className={css.inlineError} role="alert">
          <span className={css.inlineErrorMessage}>{inlineError}</span>
          <button type="button" className={css.inlineErrorRetry} onClick={retryInline}>
            {t('browser.error.retry')}
          </button>
        </div>
      )}
      <div className={css.body}>
        <div
          ref={viewportHostRef}
          className={css.viewportHost}
          role="tabpanel"
          aria-label={t('browser.screencast.aria')}
          aria-busy={showLoading}
        />
        {showLoading
          ? (
            <div className={css.loadingOverlay}>
              <span className={css.spinner} aria-hidden="true">
                <IconLoadingOutline16 size={24} />
              </span>
              <div className={css.loadingCopy}>{t('browser.loading.connecting')}</div>
            </div>
          )
          : null}
      </div>
      <span className={css.hidden}>{activeTab?.title ?? ''}</span>
    </div>
  )
}
