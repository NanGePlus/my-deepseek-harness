// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  SessionId, SessionListState, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { BrowserPanel, type BrowserPanelProps } from '../src/client/BrowserPanel.tsx'
import { createBrowserPanelStore, browserWorkspaceState } from '../src/client/stores.ts'
import { formatBrowserZoomLabel } from '../src/client/browser-zoom.ts'
import { DEFAULT_BROWSER_TAB_URL } from '../src/client/browser-tab-title.ts'
import { zh } from '../src/client/locales.ts'

class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(): void { this.callback([], this) }
  disconnect(): void {}
  unobserve(): void {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  cleanup()
  if (typeof localStorage !== 'undefined') localStorage.removeItem('dsh.browser.panel.v1')
})

const BLANK_PAGE = { url: 'about:blank', title: '', canGoBack: false, canGoForward: false } as const
const BLANK_TAB = { tabId: 'live-1', url: 'about:blank', title: '', selected: true, canGoBack: false, canGoForward: false } as const
const SID = 's1' as SessionId
const WID = 'ws1' as WorkspaceId
const ROOT = '/w/alpha'

function workspace(over: Partial<WorkspaceView> = {}): WorkspaceView {
  return {
    workspaceId: WID,
    path: ROOT,
    title: 'alpha',
    sessionIds: [SID],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function workspacesState(items: WorkspaceView[]) {
  return {
    items,
    archivedSessionIds: [],
    state: 'idle' as const,
    phase: 'ready' as const,
    error: null,
    baselinesReady: true,
    recentWorkspaceId: items[0]?.workspaceId,
  }
}

function sessionsState(current: SessionId | undefined): SessionListState {
  return {
    ids: current === undefined ? [] : [current],
    byId: {},
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot))
  }
}

type MountOverrides = Partial<BrowserPanelProps> & {
  items?: WorkspaceView[]
  noCurrentSession?: boolean
  sessionId?: SessionId
}

function mount(over: MountOverrides = {}) {
  const browserList = vi.fn(over.browserList ?? (async () => ({ tabs: [] })))
  const browserCreateTab = vi.fn(over.browserCreateTab ?? (async () => ({ tabId: 'tab-1' })))
  const browserCloseTab = vi.fn(over.browserCloseTab ?? (async () => ({ closed: true as const })))
  const browserSelectTab = vi.fn(over.browserSelectTab ?? (async () => ({ selected: true as const })))
  const browserNavigate = vi.fn(over.browserNavigate ?? (async () => BLANK_PAGE))
  const browserGoBack = vi.fn(over.browserGoBack ?? (async () => BLANK_PAGE))
  const browserGoForward = vi.fn(over.browserGoForward ?? (async () => BLANK_PAGE))
  const browserReload = vi.fn(over.browserReload ?? (async () => BLANK_PAGE))
  const browserResizeViewport = vi.fn(over.browserResizeViewport ?? (async () => ({ resized: true as const })))
  const browserSendPointer = vi.fn(over.browserSendPointer ?? (async () => ({ sent: true as const })))
  const browserSendKeyboard = vi.fn(over.browserSendKeyboard ?? (async () => ({ sent: true as const })))
  const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>(over.browserWatchScreencast ?? ((
    _workspaceId,
    _tabId,
    onFrame,
    _signal,
    onOpen,
  ) => {
    onOpen?.()
    onFrame({
      type: 'host/browser-screencast',
      data: 'ZmFrZQ==',
      width: 800,
      height: 600,
    })
  }))
  const panelStore = over.useStore === undefined ? createBrowserPanelStore().create() : undefined
  const workspacesStore = createSnapshotStore(workspacesState(over.items ?? [workspace()]))
  const sessionsStore = createSnapshotStore(sessionsState(
    over.noCurrentSession ? undefined : (over.sessionId ?? SID),
  ))
  const props: BrowserPanelProps = {
    visible: over.visible ?? true,
    t: makeTranslate(zh),
    useSessions: over.useSessions ?? hookOf(sessionsStore),
    useWorkspaces: over.useWorkspaces ?? hookOf(workspacesStore),
    useStore: over.useStore ?? hookOf(panelStore!),
    actions: over.actions ?? panelStore!.actions,
    browserList,
    browserCreateTab,
    browserCloseTab,
    browserSelectTab,
    browserNavigate,
    browserGoBack,
    browserGoForward,
    browserReload,
    browserResizeViewport,
    browserSendPointer,
    browserSendKeyboard,
    browserWatchScreencast,
    ...over,
  }
  const view = render(<BrowserPanel {...props} />)
  const ensureViewportHostSize = () => {
    const host = view.container.querySelector('[role="tabpanel"]')
    if (host instanceof HTMLElement) {
      Object.defineProperty(host, 'clientWidth', { value: 640, configurable: true })
      Object.defineProperty(host, 'clientHeight', { value: 480, configurable: true })
    }
  }
  ensureViewportHostSize()
  return {
    browserList,
    browserCreateTab,
    browserCloseTab,
    browserSelectTab,
    browserNavigate,
    browserGoBack,
    browserGoForward,
    browserReload,
    browserResizeViewport,
    browserSendPointer,
    browserSendKeyboard,
    browserWatchScreencast,
    panelStore: panelStore!,
    workspacesStore,
    sessionsStore,
    props,
    view,
    rerender: (next: Partial<BrowserPanelProps> = {}) => {
      view.rerender(<BrowserPanel {...props} {...next} />)
      ensureViewportHostSize()
    },
    ensureViewportHostSize,
    unmount: view.unmount,
  }
}

describe('BrowserPanel', () => {
  it('empty-unbound: shows 无法使用浏览器 without tab chrome when no Workspace is bound', () => {
    mount({ noCurrentSession: true, items: [workspace({ sessionIds: [] })] })
    expect(screen.getByText('无法使用浏览器')).toBeTruthy()
    expect(screen.getByText('请先选择 Workspace 并开始会话。')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByLabelText('地址栏')).toBeNull()
  })

  it('disabled-unbound: does not call Host browser RPC when Workspace is unbound', () => {
    const { browserCreateTab, browserList } = mount({ noCurrentSession: true, items: [] })
    expect(browserCreateTab).not.toHaveBeenCalled()
    expect(browserList).not.toHaveBeenCalled()
  })

  it('default: lists then auto-creates about:blank and renders tab bar + screencast host', async () => {
    const { browserList, browserCreateTab, browserWatchScreencast, ensureViewportHostSize } = mount()
    await waitFor(() => { expect(browserList).toHaveBeenCalledWith(WID, expect.any(AbortSignal)) })
    await waitFor(() => {
      expect(browserCreateTab).toHaveBeenCalledWith(WID, DEFAULT_BROWSER_TAB_URL, expect.any(AbortSignal))
    })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    ensureViewportHostSize()
    await waitFor(() => { expect(browserWatchScreencast).toHaveBeenCalled() })
    expect(screen.getByRole('tabpanel')).toBeTruthy()
  })

  it('default: reuses Host list rows instead of creating when tabs already exist', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [{ tabId: 'live-1', url: 'https://example.com', title: 'Example', selected: true, canGoBack: true, canGoForward: false }],
    }))
    const browserCreateTab = vi.fn()
    mount({ browserList, browserCreateTab })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy() })
    expect(browserCreateTab).not.toHaveBeenCalled()
  })

  it('loading: shows 连接中… while SSE opens', async () => {
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      _tabId,
      _onFrame,
      _signal,
    ) => { /* defer onOpen */ })
    mount({ browserWatchScreencast })
    await waitFor(() => { expect(screen.getByText('连接中…')).toBeTruthy() })
  })

  it('US-8: focuses the address bar after the first automatic about:blank tab', async () => {
    mount()
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBe(document.activeElement) })
  })

  it('workspace binding: browserList uses the current session Workspace id', async () => {
    const WID2 = 'ws2' as WorkspaceId
    const browserList = vi.fn(async () => ({ tabs: [] }))
    mount({
      browserList,
      sessionId: 's2' as SessionId,
      items: [workspace(), workspace({ workspaceId: WID2, sessionIds: ['s2' as SessionId], title: 'beta' })],
    })
    await waitFor(() => { expect(browserList).toHaveBeenCalledWith(WID2, expect.any(AbortSignal)) })
  })

  it('US-5: same Workspace store survives Session switch within one Workspace', async () => {
    const WID2 = 'ws2' as WorkspaceId
    const SID2 = 's2' as SessionId
    const panelStore = createBrowserPanelStore().create()
    panelStore.actions.setWorkspaceTabs(WID, [{
      tabId: 'ws1-tab', url: 'https://alpha.test', title: 'Alpha', canGoBack: false, canGoForward: false,
    }])
    panelStore.actions.setWorkspaceTabs(WID2, [{
      tabId: 'ws2-tab', url: 'https://beta.test', title: 'Beta', canGoBack: false, canGoForward: false,
    }])
    const browserCreateTab = vi.fn()
    const workspacesStore = createSnapshotStore(workspacesState([
      workspace(),
      workspace({ workspaceId: WID2, sessionIds: [SID2], title: 'beta', path: '/w/beta' }),
    ]))
    const sessionsStore = createSnapshotStore(sessionsState(SID))
    const browserList = vi.fn(async () => ({ tabs: [] }))
    const props = {
      visible: true,
      t: makeTranslate(zh),
      useSessions: hookOf(sessionsStore),
      useWorkspaces: hookOf(workspacesStore),
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab,
      browserCloseTab: vi.fn(),
      browserSelectTab: vi.fn(),
      browserNavigate: vi.fn(),
      browserGoBack: vi.fn(),
      browserGoForward: vi.fn(),
      browserReload: vi.fn(),
      browserResizeViewport: vi.fn(),
      browserSendPointer: vi.fn(),
      browserSendKeyboard: vi.fn(),
      browserWatchScreencast: vi.fn((_w, _t, _f, _s, onOpen) => { onOpen?.() }),
    }
    const view = render(<BrowserPanel {...props} />)
    expect(screen.getByRole('tab', { name: 'Alpha' })).toBeTruthy()
    act(() => { sessionsStore.set(sessionsState(SID2)) })
    view.rerender(<BrowserPanel {...props} />)
    expect(screen.getByRole('tab', { name: 'Beta' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Alpha' })).toBeNull()
    expect(browserCreateTab).not.toHaveBeenCalled()
    act(() => { sessionsStore.set(sessionsState(SID)) })
    view.rerender(<BrowserPanel {...props} />)
    expect(screen.getByRole('tab', { name: 'Alpha' })).toBeTruthy()
  })

  it('US-6: switching Session shows the bound Workspace browser tab set', async () => {
    const WID2 = 'ws2' as WorkspaceId
    const SID2 = 's2' as SessionId
    const browserList = vi.fn(async (workspaceId: WorkspaceId) => ({
      tabs: workspaceId === WID
        ? [{ tabId: 'live-1', url: 'https://alpha.test', title: 'Alpha', selected: true, canGoBack: false, canGoForward: false }]
        : [{ tabId: 'live-2', url: 'https://beta.test', title: 'Beta', selected: true, canGoBack: false, canGoForward: false }],
    }))
    const items = [
      workspace(),
      workspace({ workspaceId: WID2, sessionIds: [SID2], title: 'beta', path: '/w/beta' }),
    ]
    const workspacesStore = createSnapshotStore(workspacesState(items))
    const sessionsStore = createSnapshotStore(sessionsState(SID))
    const panelStore = createBrowserPanelStore().create()
    const props: BrowserPanelProps = {
      visible: true,
      t: makeTranslate(zh),
      useSessions: hookOf(sessionsStore),
      useWorkspaces: hookOf(workspacesStore),
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab: vi.fn(async () => ({ tabId: 'ignored' })),
      browserCloseTab: vi.fn(),
      browserSelectTab: vi.fn(),
      browserNavigate: vi.fn(),
      browserGoBack: vi.fn(),
      browserGoForward: vi.fn(),
      browserReload: vi.fn(),
      browserResizeViewport: vi.fn(),
      browserSendPointer: vi.fn(),
      browserSendKeyboard: vi.fn(),
      browserWatchScreencast: vi.fn((_w, _s, _f, _s2, onOpen) => { onOpen?.() }),
    }
    const view = render(<BrowserPanel {...props} />)
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Alpha' })).toBeTruthy() })
    act(() => { sessionsStore.set(sessionsState(SID2)) })
    view.rerender(<BrowserPanel {...props} />)
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Beta' })).toBeTruthy() })
    expect(browserWorkspaceState(panelStore.getSnapshot(), WID).tabs).toHaveLength(1)
    expect(browserWorkspaceState(panelStore.getSnapshot(), WID2).tabs).toHaveLength(1)
  })

  it('US-7: session switch does not close browser tabs through Host RPC', async () => {
    const WID2 = 'ws2' as WorkspaceId
    const SID2 = 's2' as SessionId
    const browserCloseTab = vi.fn(async () => ({ closed: true as const }))
    const browserList = vi.fn(async (workspaceId: WorkspaceId) => ({
      tabs: workspaceId === WID
        ? [{ tabId: 'live-1', url: 'https://alpha.test', title: 'Alpha', selected: true, canGoBack: false, canGoForward: false }]
        : [{ tabId: 'live-2', url: 'https://beta.test', title: 'Beta', selected: true, canGoBack: false, canGoForward: false }],
    }))
    const { sessionsStore, rerender } = mount({
      browserCloseTab,
      browserList,
      items: [
        workspace(),
        workspace({ workspaceId: WID2, sessionIds: [SID2], title: 'beta', path: '/w/beta' }),
      ],
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Alpha' })).toBeTruthy() })
    act(() => { sessionsStore.set(sessionsState(SID2)) })
    rerender()
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Beta' })).toBeTruthy() })
    expect(browserCloseTab).not.toHaveBeenCalled()
  })

  it('does not create tabs when the Browser segment is hidden', async () => {
    const { browserCreateTab } = mount({ visible: false })
    await act(async () => { await Promise.resolve() })
    expect(browserCreateTab).not.toHaveBeenCalled()
  })

  it('US-21: syncs viewport size to Host when screencast connects', async () => {
    const { browserResizeViewport, ensureViewportHostSize, rerender } = mount()
    await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    await waitFor(() => {
      expect(browserResizeViewport).toHaveBeenCalledWith(WID, 'tab-1', 640, 480, expect.any(AbortSignal))
    })
  })

  it('pointer and keyboard events forward through Host RPC', async () => {
    const { browserSendPointer, browserSendKeyboard, ensureViewportHostSize, rerender } = mount()
    await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    await waitFor(() => {
      expect(screen.getByRole('tabpanel').querySelector('div[tabindex="0"]')).toBeTruthy()
    })
    const stage = screen.getByRole('tabpanel').querySelector('div[tabindex="0"]')! as HTMLElement
    stage.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    })
    fireEvent.mouseDown(stage, { clientX: 10, clientY: 20, button: 0 })
    fireEvent.keyDown(stage, { key: 'a' })
    await waitFor(() => {
      expect(browserSendPointer).toHaveBeenCalled()
      expect(browserSendKeyboard).toHaveBeenCalled()
    })
  })

  it('navigates from the address bar on Enter', async () => {
    const browserNavigate = vi.fn(async () => BLANK_PAGE)
    const { browserNavigate: navigateMock, ensureViewportHostSize, rerender } = mount({ browserNavigate })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(WID, 'tab-1', 'https://example.com/', expect.any(AbortSignal))
    })
  })

  it('creates a new tab from the + control', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [{ tabId: 'live-1', url: 'about:blank', title: '', selected: true, canGoBack: false, canGoForward: false }],
    }))
    const browserCreateTab = vi.fn(async () => ({ tabId: 'live-2' }))
    mount({ browserList, browserCreateTab })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('新建标签页'))
    await waitFor(() => {
      expect(browserCreateTab).toHaveBeenCalledWith(WID, DEFAULT_BROWSER_TAB_URL, expect.any(AbortSignal))
    })
  })

  it('shows inline stream errors and retries the screencast subscription', async () => {
    let attempt = 0
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      _tabId,
      _onFrame,
      _signal,
      _onOpen,
      onError,
    ) => {
      attempt += 1
      if (attempt === 1) onError?.('stream failed')
    })
    const { rerender, ensureViewportHostSize } = mount({ browserWatchScreencast })
    await waitFor(() => { expect(screen.getByText('stream failed')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => { expect(browserWatchScreencast.mock.calls.length).toBeGreaterThan(1) })
  })

  it('forwards back, forward, and reload through Host RPC', async () => {
    const browserGoBack = vi.fn(async () => BLANK_PAGE)
    const browserGoForward = vi.fn(async () => BLANK_PAGE)
    const browserReload = vi.fn(async () => BLANK_PAGE)
    mount({
      browserList: vi.fn(async () => ({
        tabs: [{ ...BLANK_TAB, canGoBack: true, canGoForward: true }],
      })),
      browserGoBack,
      browserGoForward,
      browserReload,
    })
    await waitFor(() => { expect(screen.getByLabelText('后退')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('后退'))
    fireEvent.click(screen.getByLabelText('前进'))
    fireEvent.click(screen.getByLabelText('刷新'))
    await waitFor(() => {
      expect(browserGoBack).toHaveBeenCalled()
      expect(browserGoForward).toHaveBeenCalled()
      expect(browserReload).toHaveBeenCalled()
    })
  })

  it('closes a tab when more than one tab exists', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [
        { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true, canGoBack: false, canGoForward: false },
        { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
      ],
    }))
    const browserCloseTab = vi.fn(async () => ({ closed: true as const }))
    mount({ browserList, browserCloseTab })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy() })
    fireEvent.click(screen.getAllByLabelText('关闭')[0]!)
    await waitFor(() => { expect(browserCloseTab).toHaveBeenCalledWith(WID, 'live-1', expect.any(AbortSignal)) })
  })

  it('selects another tab and surfaces non-unavailable stream/error frames inline', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [
        { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true, canGoBack: false, canGoForward: false },
        { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
      ],
    }))
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      tabId,
      onFrame,
      _signal,
      onOpen,
    ) => {
      onOpen?.()
      if (tabId === 'live-1') {
        onFrame({ type: 'stream/error', error: { code: 'internal', message: 'boom', details: {} } })
      }
    })
    const browserSelectTab = vi.fn(async () => ({ selected: true as const }))
    mount({ browserList, browserWatchScreencast, browserSelectTab })
    await waitFor(() => { expect(screen.getByText('boom')).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    await waitFor(() => { expect(browserSelectTab).toHaveBeenCalledWith(WID, 'live-2', expect.any(AbortSignal)) })
  })

  it('surfaces navigation failures inline', async () => {
    const browserGoBack = vi.fn(async () => Promise.reject(new Error('back failed')))
    mount({
      browserList: vi.fn(async () => ({
        tabs: [{ ...BLANK_TAB, canGoBack: true, canGoForward: false }],
      })),
      browserGoBack,
    })
    await waitFor(() => { expect(screen.getByLabelText('后退')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('后退'))
    await waitFor(() => { expect(screen.getByText('back failed')).toBeTruthy() })
  })

  it('surfaces automatic tab creation failures inline', async () => {
    const browserCreateTab = vi.fn(async () => Promise.reject(new Error('create failed')))
    mount({ browserCreateTab })
    await waitFor(() => { expect(screen.getByText('create failed')).toBeTruthy() })
  })

  it('surfaces browserList failures during bootstrap inline', async () => {
    const browserList = vi.fn(async () => Promise.reject(new Error('list failed')))
    mount({ browserList })
    await waitFor(() => { expect(screen.getByText('list failed')).toBeTruthy() })
  })

  it('surfaces forward and reload failures inline', async () => {
    const browserGoForward = vi.fn(async () => Promise.reject(new Error('forward failed')))
    const browserReload = vi.fn(async () => Promise.reject(new Error('reload failed')))
    mount({
      browserList: vi.fn(async () => ({
        tabs: [{ ...BLANK_TAB, canGoBack: false, canGoForward: true }],
      })),
      browserGoForward,
      browserReload,
    })
    await waitFor(() => { expect(screen.getByLabelText('前进')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('前进'))
    await waitFor(() => { expect(screen.getByText('forward failed')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('刷新'))
    await waitFor(() => { expect(screen.getByText('reload failed')).toBeTruthy() })
  })

  it('surfaces address navigation and pointer forwarding failures inline', async () => {
    const browserNavigate = vi.fn(async () => Promise.reject(new Error('navigate failed')))
    const browserSendPointer = vi.fn(async () => Promise.reject(new Error('pointer failed')))
    const { ensureViewportHostSize, rerender } = mount({ browserNavigate, browserSendPointer })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByText('navigate failed')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    await waitFor(() => {
      expect(screen.getByRole('tabpanel').querySelector('div[tabindex="0"]')).toBeTruthy()
    })
    const stage = screen.getByRole('tabpanel').querySelector('div[tabindex="0"]')! as HTMLElement
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}),
    })
    fireEvent.mouseDown(stage, { clientX: 10, clientY: 20, button: 0 })
    await waitFor(() => { expect(screen.getByText('pointer failed')).toBeTruthy() })
  })

  it('does not auto-create when deferAutoCreate is set until the segment is re-entered', async () => {
    const panelStore = createBrowserPanelStore().create()
    panelStore.actions.setDeferAutoCreate(WID, true)
    const browserCreateTab = vi.fn()
    const { rerender } = mount({
      browserCreateTab,
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      visible: false,
    })
    await act(async () => { await Promise.resolve() })
    expect(browserCreateTab).not.toHaveBeenCalled()
    rerender({ visible: true })
    await waitFor(() => { expect(browserCreateTab).toHaveBeenCalled() })
  })

  it('clears the loading overlay when SSE opens without an immediate frame', async () => {
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      _tabId,
      _onFrame,
      _signal,
      onOpen,
    ) => { onOpen?.() })
    const { ensureViewportHostSize, rerender } = mount({ browserWatchScreencast })
    await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    await waitFor(() => { expect(screen.queryByText('连接中…')).toBeNull() })
  })

  it('skips resize observation when ResizeObserver is unavailable', async () => {
    const original = globalThis.ResizeObserver
    // @ts-expect-error test-only removal of optional browser API
    delete globalThis.ResizeObserver
    try {
      mount()
      await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    } finally {
      globalThis.ResizeObserver = original
    }
  })

  it('ignores empty address submissions', async () => {
    const browserNavigate = vi.fn()
    mount({ browserNavigate })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await act(async () => { await Promise.resolve() })
    expect(browserNavigate).not.toHaveBeenCalled()
  })

  it('surfaces keyboard forwarding failures inline', async () => {
    const browserSendKeyboard = vi.fn(async () => Promise.reject(new Error('keyboard failed')))
    const { ensureViewportHostSize, rerender } = mount({ browserSendKeyboard })
    await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    await waitFor(() => {
      expect(screen.getByRole('tabpanel').querySelector('div[tabindex="0"]')).toBeTruthy()
    })
    const stage = screen.getByRole('tabpanel').querySelector('div[tabindex="0"]')! as HTMLElement
    fireEvent.keyDown(stage, { key: 'a' })
    await waitFor(() => { expect(screen.getByText('keyboard failed')).toBeTruthy() })
  })

  it('surfaces viewport resize failures inline', async () => {
    const browserResizeViewport = vi.fn(async () => Promise.reject(new Error('resize failed')))
    const { ensureViewportHostSize, rerender } = mount({ browserResizeViewport })
    await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    await waitFor(() => { expect(screen.getByText('resize failed')).toBeTruthy() })
  })

  it('debounces viewport resize when the screencast host resizes', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [{ tabId: 'live-1', url: 'about:blank', title: '', selected: true, canGoBack: false, canGoForward: false }],
    }))
    const browserResizeViewport = vi.fn(async () => ({ resized: true as const }))
    mount({ browserList, browserResizeViewport })
    await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    browserResizeViewport.mockClear()
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 200) }) })
    expect(browserResizeViewport).toHaveBeenCalled()
  })

  it('skips auto-create while deferAutoCreate stays set on a visible segment', async () => {
    const panelStore = createBrowserPanelStore().create()
    panelStore.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '', canGoBack: false, canGoForward: false }], 'a')
    const browserCreateTab = vi.fn()
    const browserList = vi.fn(async () => ({ tabs: [] }))
    const { rerender } = mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserCreateTab,
      browserList,
    })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    browserCreateTab.mockClear()
    browserList.mockClear()
    act(() => {
      panelStore.actions.setWorkspaceTabs(WID, [])
      panelStore.actions.setDeferAutoCreate(WID, true)
    })
    rerender()
    await act(async () => { await Promise.resolve() })
    expect(browserCreateTab).not.toHaveBeenCalled()
    expect(browserList).not.toHaveBeenCalled()
  })

  it('swallows DirectoryBrowseError when closing or selecting tabs', async () => {
    const { DirectoryBrowseError } = await import('@deepseek-ai/dsh-client-runtime/client')
    const browserList = vi.fn(async () => ({
      tabs: [
        { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true, canGoBack: false, canGoForward: false },
        { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
      ],
    }))
    const browseError = new DirectoryBrowseError({
      code: 'browser-tab-not-found',
      message: 'browse failed',
      details: { workspaceId: WID, tabId: 'live-1' },
    })
    const browserCloseTab = vi.fn(async () => Promise.reject(browseError))
    const browserSelectTab = vi.fn(async () => Promise.reject(browseError))
    mount({ browserList, browserCloseTab, browserSelectTab })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy() })
    fireEvent.click(screen.getAllByLabelText('关闭')[0]!)
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Two' })).toBeTruthy()
  })

  it('ignores non-Enter keys in the address bar', async () => {
    const browserNavigate = vi.fn()
    mount({ browserNavigate })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'a' })
    expect(browserNavigate).not.toHaveBeenCalled()
  })

  it('updates tab metadata after successful back navigation', async () => {
    const browserGoBack = vi.fn(async () => ({
      url: 'https://prev.test', title: 'Prev', canGoBack: false, canGoForward: true,
    }))
    mount({
      browserList: vi.fn(async () => ({
        tabs: [{ ...BLANK_TAB, canGoBack: true, canGoForward: false }],
      })),
      browserGoBack,
    })
    await waitFor(() => { expect(screen.getByLabelText('后退')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('后退'))
    await waitFor(() => { expect(screen.getByDisplayValue('https://prev.test')).toBeTruthy() })
  })

  it('disabled-last-tab: hides close affordance when only one tab remains', async () => {
    mount({ browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })) })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    expect(screen.queryByLabelText('关闭')).toBeNull()
  })

  it('nav-disabled-history: disables back and forward without history', async () => {
    mount({
      browserList: vi.fn(async () => ({
        tabs: [{ ...BLANK_TAB, canGoBack: false, canGoForward: false }],
      })),
    })
    await waitFor(() => {
      expect(screen.getByLabelText('后退')).toHaveProperty('disabled', true)
      expect(screen.getByLabelText('前进')).toHaveProperty('disabled', true)
    })
  })

  it('US-9: creates a new tab from + and focuses the address bar', async () => {
    const browserCreateTab = vi.fn(async () => ({ tabId: 'live-2' }))
    mount({ browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })), browserCreateTab })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('新建标签页'))
    await waitFor(() => {
      expect(browserCreateTab).toHaveBeenCalledWith(WID, DEFAULT_BROWSER_TAB_URL, expect.any(AbortSignal))
      expect(screen.getByLabelText('地址栏')).toBe(document.activeElement)
    })
  })

  it('US-10: closes tabs from the context menu while keeping at least one tab', async () => {
    const browserCloseTab = vi.fn(async () => ({ closed: true as const }))
    mount({
      browserList: vi.fn(async () => ({
        tabs: [
          { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true, canGoBack: false, canGoForward: false },
          { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
        ],
      })),
      browserCloseTab,
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy() })
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'One' }))
    fireEvent.click(await screen.findByText('关闭其他'))
    await waitFor(() => { expect(browserCloseTab).toHaveBeenCalledWith(WID, 'live-2', expect.any(AbortSignal)) })
    expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy()
  })

  it('US-12: navigates localhost and public URLs from the address bar', async () => {
    const browserNavigate = vi.fn(async (_wid, _tabId, url: string) => ({
      url,
      title: 'Loaded',
      canGoBack: true,
      canGoForward: false,
    }))
    mount({ browserNavigate })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: '127.0.0.1:5173' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => {
      expect(browserNavigate).toHaveBeenCalledWith(WID, 'tab-1', 'http://127.0.0.1:5173/', expect.any(AbortSignal))
    })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com/docs' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => {
      expect(browserNavigate).toHaveBeenCalledWith(WID, 'tab-1', 'https://example.com/docs', expect.any(AbortSignal))
    })
  })

  it('US-15: opens the current tab URL in the external browser', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    mount({
      browserList: vi.fn(async () => ({
        tabs: [{
          tabId: 'live-1',
          url: 'https://example.com/page',
          title: 'Example',
          selected: true,
          canGoBack: false,
          canGoForward: false,
        }],
      })),
    })
    await waitFor(() => { expect(screen.getByLabelText('在外部浏览器打开')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('在外部浏览器打开'))
    expect(openSpy).toHaveBeenCalledWith('https://example.com/page', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })

  it('empty-unavailable: shows 浏览器不可用 card with retry while keeping stored tabs visible', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [{
        tabId: 'live-1',
        url: 'https://example.com',
        title: 'Example',
        selected: true,
        canGoBack: false,
        canGoForward: false,
      }],
    }))
    let attempt = 0
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      _tabId,
      onFrame,
      _signal,
      onOpen,
    ) => {
      attempt += 1
      onOpen?.()
      if (attempt === 1) {
        onFrame({
          type: 'stream/error',
          error: { code: 'browser-unavailable', message: 'Chromium 未安装', details: { reason: 'chromium-missing' } },
        })
      }
    })
    mount({ browserList, browserWatchScreencast })
    await waitFor(() => {
      expect(screen.getByText('浏览器不可用')).toBeTruthy()
      expect(screen.getByText('Chromium 未安装')).toBeTruthy()
      expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy()
    })
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => { expect(browserWatchScreencast.mock.calls.length).toBeGreaterThan(1) })
  })

  it('US-17: bootstrap browser-unavailable without tabs shows retry card and no tab chrome', async () => {
    const { DirectoryBrowseError } = await import('@deepseek-ai/dsh-client-runtime/client')
    const browserCreateTab = vi.fn(async () => Promise.reject(new DirectoryBrowseError({
      code: 'browser-unavailable',
      message: '无法启动浏览器',
      details: { reason: 'context-start-failed' },
    })))
    mount({ browserCreateTab })
    await waitFor(() => { expect(screen.getByText('浏览器不可用')).toBeTruthy() })
    expect(screen.getByText('无法启动浏览器')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => { expect(browserCreateTab.mock.calls.length).toBeGreaterThan(1) })
  })

  it('error-nav: navigation failure keeps the tab open with inline error and canvas empty state', async () => {
    const browserNavigate = vi.fn(async () => Promise.reject(new Error('dns failed')))
    mount({ browserNavigate })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://missing.example' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByText('dns failed')).toBeTruthy() })
    expect(screen.getByText('无法加载此页')).toBeTruthy()
    expect(screen.getByRole('tablist')).toBeTruthy()
  })

  it('US-13 / info-external: first non-localhost visit shows inline info without modal', async () => {
    const browserNavigate = vi.fn(async (_wid, _tabId, url: string) => ({
      url,
      title: 'Example',
      canGoBack: false,
      canGoForward: false,
    }))
    mount({ browserNavigate })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByText('正在访问外部站点')).toBeTruthy() })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com/docs' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByText('正在访问外部站点')).toBeNull() })
  })

  it('US-14 / menu-overflow: overflow menu exposes Hard Reload, Copy URL, and Zoom controls', async () => {
    const panelStore = createBrowserPanelStore().create()
    const browserReload = vi.fn(async () => ({
      url: 'https://example.com', title: 'Example', canGoBack: false, canGoForward: false,
    }))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    mount({
      browserList: vi.fn(async () => ({
        tabs: [{
          tabId: 'live-1',
          url: 'https://example.com',
          title: 'Example',
          selected: true,
          canGoBack: false,
          canGoForward: false,
        }],
      })),
      browserReload,
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
    })
    await waitFor(() => { expect(screen.getByLabelText('更多操作')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(await screen.findByText('Hard Reload'))
    await waitFor(() => {
      expect(browserReload).toHaveBeenCalledWith(WID, 'live-1', true)
    })
    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(await screen.findByText('Copy Current URL'))
    expect(writeText).toHaveBeenCalledWith('https://example.com')
    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(await screen.findByText('+'))
    expect(browserWorkspaceState(panelStore.getSnapshot(), WID).zoom).toBe(1.25)
    const zoomOut = (await screen.findAllByRole('menuitem')).find(item => item.textContent === '−')
    expect(zoomOut).toBeTruthy()
    fireEvent.click(zoomOut!)
    expect(browserWorkspaceState(panelStore.getSnapshot(), WID).zoom).toBe(1)
    fireEvent.click(await screen.findByText('重置'))
    expect(browserWorkspaceState(panelStore.getSnapshot(), WID).zoom).toBe(1)
    expect(formatBrowserZoomLabel(browserWorkspaceState(panelStore.getSnapshot(), WID).zoom)).toBe('100%')
  })

  it('closes the overflow and tab context menus on Escape', async () => {
    mount({
      browserList: vi.fn(async () => ({
        tabs: [
          { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true, canGoBack: false, canGoForward: false },
          { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
        ],
      })),
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy() })
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'One' }))
    expect(await screen.findByText('关闭其他')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByText('关闭其他')).toBeNull() })
    fireEvent.click(screen.getByLabelText('更多操作'))
    expect(await screen.findByText('Hard Reload')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByText('Hard Reload')).toBeNull() })
  })

  it('segment-hidden: aborts screencast SSE when the Browser segment hides without closing Host tabs', async () => {
    let abortSignal: AbortSignal | undefined
    const browserList = vi.fn(async () => ({ tabs: [BLANK_TAB] }))
    const browserCloseTab = vi.fn()
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      _tabId,
      _onFrame,
      signal,
      onOpen,
    ) => {
      abortSignal = signal
      onOpen?.()
    })
    const { rerender, browserWatchScreencast: watchMock } = mount({
      browserList,
      browserCloseTab,
      browserWatchScreencast,
    })
    await waitFor(() => { expect(abortSignal).toBeDefined() })
    expect(abortSignal?.aborted).toBe(false)
    const callsBeforeHide = watchMock.mock.calls.length
    rerender({ visible: false })
    expect(abortSignal?.aborted).toBe(true)
    expect(browserCloseTab).not.toHaveBeenCalled()
    rerender({ visible: true })
    await waitFor(() => { expect(watchMock.mock.calls.length).toBeGreaterThan(callsBeforeHide) })
  })

  it('loading-reconnect: remount with persisted tabs calls Host list and reconnects screencast', async () => {
    const panelStore = createBrowserPanelStore().create()
    panelStore.actions.setWorkspaceTabs(WID, [{
      tabId: 'live-1',
      url: 'https://example.com',
      title: 'Example',
      canGoBack: false,
      canGoForward: false,
    }], 'live-1')
    panelStore.actions.setZoom(WID, 1.25)
    const browserList = vi.fn(async () => ({
      tabs: [{
        tabId: 'live-1',
        url: 'https://example.com',
        title: 'Example',
        selected: true,
        canGoBack: true,
        canGoForward: false,
      }],
    }))
    const browserCreateTab = vi.fn()
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      _tabId,
      _onFrame,
      _signal,
      onOpen,
    ) => { onOpen?.() })
    const first = mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab,
      browserWatchScreencast,
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy() })
    expect(browserCreateTab).not.toHaveBeenCalled()
    first.unmount()
    browserList.mockClear()
    browserWatchScreencast.mockClear()
    mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab,
      browserWatchScreencast,
    })
    await waitFor(() => { expect(browserList).toHaveBeenCalledWith(WID, expect.any(AbortSignal)) })
    await waitFor(() => { expect(browserWatchScreencast).toHaveBeenCalled() })
    expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy()
    expect(browserWorkspaceState(panelStore.getSnapshot(), WID).zoom).toBe(1.25)
    expect(browserCreateTab).not.toHaveBeenCalled()
  })

  it('zoom-client: changing Client zoom does not change Host resizeViewport dimensions', async () => {
    const panelStore = createBrowserPanelStore().create()
    const browserList = vi.fn(async () => ({ tabs: [BLANK_TAB] }))
    const browserResizeViewport = vi.fn(async () => ({ resized: true as const }))
    const { browserResizeViewport: resizeMock, ensureViewportHostSize, rerender } = mount({
      browserList,
      browserResizeViewport,
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
    })
    await waitFor(() => { expect(screen.getByRole('tabpanel')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    await waitFor(() => { expect(resizeMock).toHaveBeenCalled() })
    const firstCall = resizeMock.mock.calls[0]
    resizeMock.mockClear()
    act(() => { panelStore.actions.setZoom(WID, 1.25) })
    ensureViewportHostSize()
    rerender()
    await act(async () => { await Promise.resolve() })
    expect(resizeMock).not.toHaveBeenCalled()
    act(() => { panelStore.actions.setZoom(WID, 1) })
    rerender()
    expect(resizeMock).not.toHaveBeenCalled()
    if (firstCall !== undefined) {
      expect(firstCall[2]).toBe(640)
      expect(firstCall[3]).toBe(480)
    }
  })

  it('loading-hard-reload: Hard Reload keeps the previous frame visible without the dim overlay', async () => {
    let resolveReload: ((value: typeof BLANK_PAGE) => void) | undefined
    const browserReload = vi.fn(async () => new Promise<typeof BLANK_PAGE>((resolve) => {
      resolveReload = resolve
    }))
    const browserWatchScreencast = vi.fn<BrowserPanelProps['browserWatchScreencast']>((
      _workspaceId,
      _tabId,
      onFrame,
      _signal,
      onOpen,
    ) => {
      onOpen?.()
      onFrame({
        type: 'host/browser-screencast',
        data: 'ZmFrZQ==',
        width: 800,
        height: 600,
      })
    })
    const { view } = mount({
      browserList: vi.fn(async () => ({
        tabs: [{ ...BLANK_TAB, url: 'https://example.com', title: 'Example' }],
      })),
      browserReload,
      browserWatchScreencast,
    })
    await waitFor(() => { expect(screen.getByLabelText('更多操作')).toBeTruthy() })
    await waitFor(() => { expect(view.container.querySelector('img[src^="data:image/jpeg"]')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(await screen.findByText('Hard Reload'))
    await waitFor(() => { expect(browserReload).toHaveBeenCalledWith(WID, 'live-1', true) })
    expect(view.container.querySelector('[class*="loadingOverlay"]')).toBeNull()
    expect(screen.queryByText('连接中…')).toBeNull()
    resolveReload?.(BLANK_PAGE)
    await waitFor(() => { expect(view.container.querySelector('img[src^="data:image/jpeg"]')).toBeTruthy() })
  })

  it('error-nav retry reruns the failed navigation', async () => {
    let attempt = 0
    const browserNavigate = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) return Promise.reject(new Error('dns failed'))
      return { url: 'https://example.com/', title: 'Example', canGoBack: false, canGoForward: false }
    })
    mount({ browserNavigate })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByText('dns failed')).toBeTruthy() })
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => { expect(screen.queryByText('无法加载此页')).toBeNull() })
    expect(browserNavigate).toHaveBeenCalledTimes(2)
  })
})
