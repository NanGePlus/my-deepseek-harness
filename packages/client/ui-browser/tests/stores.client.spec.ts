import { describe, expect, it } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  browserWorkspaceState, createBrowserPanelStore, rowsFromBrowserList,
} from '../src/client/stores.ts'

const WID = 'ws1' as WorkspaceId

describe('browser panel store', () => {
  it('partitions tabs by workspace id', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '' }])
    expect(browserWorkspaceState(store.getSnapshot(), WID).tabs).toHaveLength(1)
    expect(browserWorkspaceState(store.getSnapshot(), 'ws2' as WorkspaceId).tabs).toHaveLength(0)
  })

  it('marks deferAutoCreate when the last tab is removed', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '' }])
    store.actions.removeTab(WID, 'a')
    expect(browserWorkspaceState(store.getSnapshot(), WID).deferAutoCreate).toBe(true)
  })

  it('maps Host list rows and selected tab id', () => {
    const mapped = rowsFromBrowserList([
      { tabId: 'a', url: 'https://a.test', title: 'A', selected: false },
      { tabId: 'b', url: 'https://b.test', title: 'B', selected: true },
    ])
    expect(mapped.selectedTabId).toBe('b')
    expect(mapped.rows).toEqual([
      { tabId: 'a', url: 'https://a.test', title: 'A' },
      { tabId: 'b', url: 'https://b.test', title: 'B' },
    ])
  })

  it('updates tab metadata and zoom per workspace', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '' }])
    store.actions.updateTabMetadata(WID, 'a', 'https://example.com', 'Example')
    store.actions.setZoom(WID, 1.25)
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs[0]?.url).toBe('https://example.com')
    expect(state.tabs[0]?.title).toBe('Example')
    expect(state.zoom).toBe(1.25)
  })

  it('upserts tabs and preserves an explicit selected tab id', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '' }], 'a')
    store.actions.upsertTab(WID, { tabId: 'b', url: 'https://b.test', title: 'B' })
    store.actions.setSelectedTab(WID, 'b')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('b')
  })

  it('ignores removeTab for unknown tab ids and toggles connecting state', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '' }])
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
      { tabId: 'a', url: 'about:blank', title: 'A' },
      { tabId: 'b', url: 'https://b.test', title: 'B' },
    ], 'b')
    store.actions.upsertTab(WID, { tabId: 'a', url: 'https://a.test', title: 'A2' })
    store.actions.removeTab(WID, 'b')
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs[0]?.title).toBe('A2')
    expect(state.selectedTabId).toBe('a')
  })

  it('defaults list selection to the first tab when none is marked selected', () => {
    expect(rowsFromBrowserList([
      { tabId: 'a', url: 'about:blank', title: '', selected: false },
    ]).selectedTabId).toBe('a')
  })

  it('keeps the current selected tab when setWorkspaceTabs omits an override', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '' }], 'a')
    store.actions.setWorkspaceTabs(WID, [
      { tabId: 'a', url: 'about:blank', title: '' },
      { tabId: 'b', url: 'https://b.test', title: 'B' },
    ])
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('a')
  })

  it('updates only the matching tab row when metadata changes', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      { tabId: 'a', url: 'about:blank', title: 'A' },
      { tabId: 'b', url: 'https://b.test', title: 'B' },
    ])
    store.actions.updateTabMetadata(WID, 'a', 'https://a.test', 'A2')
    const state = browserWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs[0]?.title).toBe('A2')
    expect(state.tabs[1]?.title).toBe('B')
  })

  it('preserves the selected tab when closing an inactive tab', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      { tabId: 'a', url: 'about:blank', title: 'A' },
      { tabId: 'b', url: 'https://b.test', title: 'B' },
    ], 'a')
    store.actions.removeTab(WID, 'b')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('a')
  })

  it('selects the next tab when the first tab is closed', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      { tabId: 'a', url: 'about:blank', title: 'A' },
      { tabId: 'b', url: 'https://b.test', title: 'B' },
    ], 'a')
    store.actions.removeTab(WID, 'a')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('b')
  })

  it('selects the previous tab when the last tab in the bar is closed', () => {
    const store = createBrowserPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [
      { tabId: 'a', url: 'about:blank', title: 'A' },
      { tabId: 'b', url: 'https://b.test', title: 'B' },
    ], 'b')
    store.actions.removeTab(WID, 'b')
    expect(browserWorkspaceState(store.getSnapshot(), WID).selectedTabId).toBe('a')
  })
})
