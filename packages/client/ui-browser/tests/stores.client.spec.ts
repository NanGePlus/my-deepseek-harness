import { describe, expect, it, afterEach } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  browserWorkspaceState, createBrowserPanelStore, rowsFromBrowserList,
} from '../src/client/stores.ts'

const WID = 'ws1' as WorkspaceId
const tab = (over: Partial<{ tabId: string; url: string; title: string; canGoBack: boolean; canGoForward: boolean }> = {}) => ({
  tabId: 'a',
  url: 'about:blank',
  title: '',
  canGoBack: false,
  canGoForward: false,
  ...over,
})

describe('browser panel store', () => {
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('dsh.browser.panel.v1')
  })

  it('partitions tabs by workspace id', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab()])
    expect(browserWorkspaceState(store.getSnapshot(), WID).tabs).toHaveLength(1)
    expect(browserWorkspaceState(store.getSnapshot(), 'ws2' as WorkspaceId).tabs).toHaveLength(0)
  })

  it('marks deferAutoCreate when the last tab is removed', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab()])
    store.actions.removeTab(WID, 'a')
    expect(browserWorkspaceState(store.getSnapshot(), WID).deferAutoCreate).toBe(true)
  })

  it('maps Host list rows and selected tab id', () => {
    const mapped = rowsFromBrowserList([
      { tabId: 'a', url: 'https://a.test', title: 'A', selected: false, canGoBack: true, canGoForward: false },
      { tabId: 'b', url: 'https://b.test', title: 'B', selected: true, canGoBack: false, canGoForward: true },
    ])
    expect(mapped.selectedTabId).toBe('b')
    expect(mapped.rows).toEqual([
      { tabId: 'a', url: 'https://a.test', title: 'A', canGoBack: true, canGoForward: false },
      { tabId: 'b', url: 'https://b.test', title: 'B', canGoBack: false, canGoForward: true },
    ])
  })

  it('updates tab metadata and zoom per workspace', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab()])
    store.actions.updateTabMetadata(WID, 'a', 'https://example.com', 'Example', true, false)
    store.actions.setZoom(WID, 1.25)
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs[0]?.url).toBe('https://example.com')
    expect(state.tabs[0]?.title).toBe('Example')
    expect(state.tabs[0]?.canGoBack).toBe(true)
    expect(state.tabs[0]?.canGoForward).toBe(false)
    expect(state.zoom).toBe(1.25)
  })

  it('upserts tabs and preserves an explicit selected tab id', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab()], 'a')
    store.actions.upsertTab(WID, tab({ tabId: 'b', url: 'https://b.test', title: 'B' }))
    store.actions.setSelectedTab(WID, 'b')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('b')
  })

  it('marks external hosts once per workspace partition', () => {
    const store = createBrowserPanelStore().create()
    store.actions.markExternalHostSeen(WID, 'example.com')
    store.actions.markExternalHostSeen(WID, 'example.com')
    expect(browserWorkspaceState(store.getSnapshot(), WID).seenExternalHosts).toEqual(['example.com'])
  })

  it('stores external info and unavailable reasons per workspace', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setExternalInfo(WID, '正在访问外部站点')
    store.actions.setBrowserUnavailable(WID, 'Chromium 未安装')
    store.actions.setNavError(WID, 'dns failed')
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.externalInfo).toBe('正在访问外部站点')
    expect(state.browserUnavailable).toBe('Chromium 未安装')
    expect(state.navError).toBe('dns failed')
  })

  it('ignores removeTab for unknown tab ids and toggles connecting state', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab()])
    store.actions.removeTab(WID, 'missing')
    store.actions.setConnecting(WID, true)
    store.actions.setCreating(WID, true)
    store.actions.setInlineError(WID, 'failed')
    store.actions.setDeferAutoCreate(WID, true)
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs).toHaveLength(1)
    expect(state.connecting).toBe(true)
    expect(state.creating).toBe(true)
    expect(state.inlineError).toBe('failed')
    expect(state.deferAutoCreate).toBe(true)
  })

  it('updates an existing tab on upsert and preserves a valid selected tab', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      tab({ title: 'A' }),
      tab({ tabId: 'b', url: 'https://b.test', title: 'B' }),
    ], 'b')
    store.actions.upsertTab(WID, tab({ url: 'https://a.test', title: 'A2' }))
    store.actions.removeTab(WID, 'b')
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs[0]?.title).toBe('A2')
    expect(state.selectedTabId).toBe('a')
  })

  it('defaults list selection to the first tab when none is marked selected', () => {
    expect(rowsFromBrowserList([
      { tabId: 'a', url: 'about:blank', title: '', selected: false, canGoBack: false, canGoForward: false },
    ]).selectedTabId).toBe('a')
  })

  it('keeps the current selected tab when setWorkspaceTabs omits an override', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab()], 'a')
    store.actions.setWorkspaceTabs(WID, [
      tab(),
      tab({ tabId: 'b', url: 'https://b.test', title: 'B' }),
    ])
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('a')
  })

  it('updates only the matching tab row when metadata changes', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      tab({ title: 'A' }),
      tab({ tabId: 'b', url: 'https://b.test', title: 'B' }),
    ])
    store.actions.updateTabMetadata(WID, 'a', 'https://a.test', 'A2', false, false)
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs[0]?.title).toBe('A2')
    expect(state.tabs[1]?.title).toBe('B')
  })

  it('ignores Chromium net-error URLs when syncing tab metadata', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab({ url: 'http://127.0.0.1:3080/', title: 'DSH' })])
    store.actions.updateTabMetadata(
      WID, 'a', 'chrome-error://chromewebdata/', 'chromewebdata', false, false,
    )
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs[0]?.url).toBe('http://127.0.0.1:3080/')
    expect(state.tabs[0]?.title).toBe('DSH')
  })

  it('preserves the selected tab when closing an inactive tab', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      tab({ title: 'A' }),
      tab({ tabId: 'b', url: 'https://b.test', title: 'B' }),
    ], 'a')
    store.actions.removeTab(WID, 'b')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('a')
  })

  it('selects the next tab when the first tab is closed', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      tab({ title: 'A' }),
      tab({ tabId: 'b', url: 'https://b.test', title: 'B' }),
    ], 'a')
    store.actions.removeTab(WID, 'a')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('b')
  })

  it('selects the previous tab when the last tab in the bar is closed', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      tab({ title: 'A' }),
      tab({ tabId: 'b', url: 'https://b.test', title: 'B' }),
    ], 'b')
    store.actions.removeTab(WID, 'b')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('a')
  })

  it('clears transient workspace fields without dropping durable tab rows', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [tab()], 'a')
    store.actions.setConnecting(WID, true)
    store.actions.setInlineError(WID, 'failed')
    store.actions.clearTransientState(WID)
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs).toHaveLength(1)
    expect(state.connecting).toBe(false)
    expect(state.inlineError).toBeUndefined()
  })
})
