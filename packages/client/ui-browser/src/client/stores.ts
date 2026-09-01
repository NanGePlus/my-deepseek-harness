/**
 * Per-Workspace embedded browser tab state. Tab rows, selection, and zoom survive
 * segment hide and are not written to the session log.
 */
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import { isChromiumInternalErrorUrl } from './browser-navigate-url.ts'

/** One live browser tab row mirrored from Host list/create. */
export interface BrowserTabRow {
  tabId: string
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
}

/** Workspace-scoped embedded browser UI state. */
export interface BrowserWorkspaceState {
  tabs: BrowserTabRow[]
  selectedTabId: string | undefined
  /** Client-side screencast scale; does not change Host viewport semantics. */
  zoom: number
  /** True while the SSE handshake for the active tab is in flight. */
  connecting: boolean
  /** True while a Host createTab request is in flight; disables the + control. */
  creating: boolean
  /** When true, an empty tab set does not auto-create until the Browser segment is re-entered. */
  deferAutoCreate: boolean
  /** Inline create, navigate, or reconnect failure copy for the active tab body. */
  inlineError: string | undefined
  /** Host Playwright / Chromium unavailable reason for the card empty state. */
  browserUnavailable: string | undefined
  /** Navigation failure copy shown under the nav bar and on the screencast canvas. */
  navError: string | undefined
  /** Inline info banner for a first visit to a non-localhost host. */
  externalInfo: string | undefined
  /** External hosts already visited in this Workspace (not written to Session log). */
  seenExternalHosts: string[]
}

/** Root store keyed by bound Workspace id. */
export interface BrowserPanelState {
  byWorkspace: Partial<Record<WorkspaceId, BrowserWorkspaceState>>
}

/** Annotation twin of the actions literal; drift fails at defineStore. */
type BrowserPanelActions = {
  setWorkspaceTabs: (
    root: BrowserPanelState,
    workspaceId: WorkspaceId,
    tabs: BrowserTabRow[],
    selectedTabId?: string,
  ) => void
  upsertTab: (root: BrowserPanelState, workspaceId: WorkspaceId, tab: BrowserTabRow) => void
  setSelectedTab: (root: BrowserPanelState, workspaceId: WorkspaceId, tabId: string) => void
  setConnecting: (root: BrowserPanelState, workspaceId: WorkspaceId, connecting: boolean) => void
  setCreating: (root: BrowserPanelState, workspaceId: WorkspaceId, creating: boolean) => void
  setInlineError: (
    root: BrowserPanelState,
    workspaceId: WorkspaceId,
    inlineError: string | undefined,
  ) => void
  setBrowserUnavailable: (
    root: BrowserPanelState,
    workspaceId: WorkspaceId,
    browserUnavailable: string | undefined,
  ) => void
  setNavError: (root: BrowserPanelState, workspaceId: WorkspaceId, navError: string | undefined) => void
  setExternalInfo: (
    root: BrowserPanelState,
    workspaceId: WorkspaceId,
    externalInfo: string | undefined,
  ) => void
  markExternalHostSeen: (root: BrowserPanelState, workspaceId: WorkspaceId, host: string) => void
  updateTabMetadata: (
    root: BrowserPanelState,
    workspaceId: WorkspaceId,
    tabId: string,
    url: string,
    title: string,
    canGoBack: boolean,
    canGoForward: boolean,
  ) => void
  removeTab: (root: BrowserPanelState, workspaceId: WorkspaceId, tabId: string) => void
  setDeferAutoCreate: (root: BrowserPanelState, workspaceId: WorkspaceId, deferAutoCreate: boolean) => void
  setZoom: (root: BrowserPanelState, workspaceId: WorkspaceId, zoom: number) => void
  clearTransientState: (root: BrowserPanelState, workspaceId: WorkspaceId) => void
}

/** Default Client zoom ratio for screencast display. */
export const DEFAULT_BROWSER_ZOOM = 1

/** Empty workspace partition used when a key is first touched. */
function emptyWorkspaceState(): BrowserWorkspaceState {
  return {
    tabs: [],
    selectedTabId: undefined,
    zoom: DEFAULT_BROWSER_ZOOM,
    connecting: false,
    creating: false,
    deferAutoCreate: false,
    inlineError: undefined,
    browserUnavailable: undefined,
    navError: undefined,
    externalInfo: undefined,
    seenExternalHosts: [],
  }
}

/** Resolve one workspace partition, creating it when absent. */
function workspaceState(root: BrowserPanelState, workspaceId: WorkspaceId): BrowserWorkspaceState {
  return root.byWorkspace[workspaceId] ?? emptyWorkspaceState()
}

/**
 * Create the embedded-browser store handle (one root instance; tabs partitioned by Workspace).
 * @returns the store handle for `slots.register`.
 */
export function createBrowserPanelStore(): EngineStoreHandle<BrowserPanelState, BrowserPanelActions> {
  return defineStore({
    init: (): BrowserPanelState => ({ byWorkspace: {} }),
    persist: 'dsh.browser.panel.v1',
    actions: {
      setWorkspaceTabs: (root, workspaceId, tabs, selectedTabId) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs,
          selectedTabId: selectedTabId ?? tabs.find(tab => tab.tabId === current.selectedTabId)?.tabId ?? tabs[0]?.tabId,
        }
      },
      upsertTab: (root, workspaceId, tab) => {
        const current = workspaceState(root, workspaceId)
        const index = current.tabs.findIndex(row => row.tabId === tab.tabId)
        const tabs = index === -1
          ? [...current.tabs, tab]
          : current.tabs.map((row, i) => (i === index ? tab : row))
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs,
          selectedTabId: current.selectedTabId ?? tab.tabId,
        }
      },
      setSelectedTab: (root, workspaceId, tabId) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, selectedTabId: tabId }
      },
      setConnecting: (root, workspaceId, connecting) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, connecting }
      },
      setCreating: (root, workspaceId, creating) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, creating }
      },
      setInlineError: (root, workspaceId, inlineError) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, inlineError }
      },
      setBrowserUnavailable: (root, workspaceId, browserUnavailable) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, browserUnavailable }
      },
      setNavError: (root, workspaceId, navError) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, navError }
      },
      setExternalInfo: (root, workspaceId, externalInfo) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, externalInfo }
      },
      markExternalHostSeen: (root, workspaceId, host) => {
        const current = workspaceState(root, workspaceId)
        if (current.seenExternalHosts.includes(host)) return
        root.byWorkspace[workspaceId] = {
          ...current,
          seenExternalHosts: [...current.seenExternalHosts, host],
        }
      },
      updateTabMetadata: (root, workspaceId, tabId, url, title, canGoBack, canGoForward) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs: current.tabs.map((row): BrowserTabRow => {
            if (row.tabId !== tabId) return row
            if (isChromiumInternalErrorUrl(url)) {
              return { ...row, canGoBack, canGoForward }
            }
            return { ...row, url, title, canGoBack, canGoForward }
          }),
        }
      },
      removeTab: (root, workspaceId, tabId) => {
        const current = workspaceState(root, workspaceId)
        const index = current.tabs.findIndex(row => row.tabId === tabId)
        if (index === -1) return
        const tabs = current.tabs.filter(row => row.tabId !== tabId)
        let selectedTabId = current.selectedTabId
        if (current.selectedTabId === tabId) {
          selectedTabId = tabs[index]?.tabId ?? tabs[index - 1]?.tabId
        }
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs,
          selectedTabId,
          deferAutoCreate: tabs.length === 0 ? true : current.deferAutoCreate,
        }
      },
      setDeferAutoCreate: (root, workspaceId, deferAutoCreate) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, deferAutoCreate }
      },
      setZoom: (root, workspaceId, zoom) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, zoom }
      },
      clearTransientState: (root, workspaceId) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = {
          ...current,
          connecting: false,
          creating: false,
          inlineError: undefined,
          browserUnavailable: undefined,
          navError: undefined,
          externalInfo: undefined,
        }
      },
    },
  })
}

/**
 * Read one workspace partition from the root store snapshot.
 * @param state - root store snapshot.
 * @param workspaceId - bound workspace id.
 * @returns the workspace partition or an empty default.
 */
export function browserWorkspaceState(
  state: BrowserPanelState,
  workspaceId: WorkspaceId,
): BrowserWorkspaceState {
  return state.byWorkspace[workspaceId] ?? emptyWorkspaceState()
}

/** Map Host list rows into store tab rows. */
export function rowsFromBrowserList(tabs: readonly {
  tabId: string
  url: string
  title: string
  selected: boolean
  canGoBack: boolean
  canGoForward: boolean
}[]): {
  rows: BrowserTabRow[]
  selectedTabId: string | undefined
} {
  const rows = tabs.map(tab => ({
    tabId: tab.tabId,
    url: tab.url,
    title: tab.title,
    canGoBack: tab.canGoBack,
    canGoForward: tab.canGoForward,
  }))
  const selected = tabs.find(tab => tab.selected)
  return { rows, selectedTabId: selected?.tabId ?? rows[0]?.tabId }
}
