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
})

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
  const browserNavigate = vi.fn(over.browserNavigate ?? (async () => ({ url: 'about:blank', title: '' })))
  const browserGoBack = vi.fn(over.browserGoBack ?? (async () => ({ url: 'about:blank', title: '' })))
  const browserGoForward = vi.fn(over.browserGoForward ?? (async () => ({ url: 'about:blank', title: '' })))
  const browserReload = vi.fn(over.browserReload ?? (async () => ({ url: 'about:blank', title: '' })))
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
      tabs: [{ tabId: 'live-1', url: 'https://example.com', title: 'Example', selected: true }],
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
      tabId: 'ws1-tab', url: 'https://alpha.test', title: 'Alpha',
    }])
    panelStore.actions.setWorkspaceTabs(WID2, [{
      tabId: 'ws2-tab', url: 'https://beta.test', title: 'Beta',
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
        ? [{ tabId: 'live-1', url: 'https://alpha.test', title: 'Alpha', selected: true }]
        : [{ tabId: 'live-2', url: 'https://beta.test', title: 'Beta', selected: true }],
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
        ? [{ tabId: 'live-1', url: 'https://alpha.test', title: 'Alpha', selected: true }]
        : [{ tabId: 'live-2', url: 'https://beta.test', title: 'Beta', selected: true }],
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
    const { browserNavigate, ensureViewportHostSize, rerender } = mount()
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    ensureViewportHostSize()
    rerender()
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => {
      expect(browserNavigate).toHaveBeenCalledWith(WID, 'tab-1', 'https://example.com', expect.any(AbortSignal))
    })
  })

  it('creates a new tab from the + control', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [{ tabId: 'live-1', url: 'about:blank', title: '', selected: true }],
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
    const browserGoBack = vi.fn(async () => ({ url: 'https://prev.test', title: 'Prev' }))
    const browserGoForward = vi.fn(async () => ({ url: 'https://next.test', title: 'Next' }))
    const browserReload = vi.fn(async () => ({ url: 'https://current.test', title: 'Current' }))
    mount({ browserGoBack, browserGoForward, browserReload })
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
        { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true },
        { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false },
      ],
    }))
    const browserCloseTab = vi.fn(async () => ({ closed: true as const }))
    mount({ browserList, browserCloseTab })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy() })
    fireEvent.click(screen.getAllByLabelText('关闭')[0]!)
    await waitFor(() => { expect(browserCloseTab).toHaveBeenCalledWith(WID, 'live-1', expect.any(AbortSignal)) })
  })

  it('selects another tab and surfaces stream/error frames inline', async () => {
    const browserList = vi.fn(async () => ({
      tabs: [
        { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true },
        { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false },
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
        onFrame({ type: 'stream/error', error: { code: 'browser-unavailable', message: 'boom', details: { reason: 'chromium-missing' } } })
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
    mount({ browserGoBack })
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
    mount({ browserGoForward, browserReload })
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
      tabs: [{ tabId: 'live-1', url: 'about:blank', title: '', selected: true }],
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
    panelStore.actions.setWorkspaceTabs(WID, [{ tabId: 'a', url: 'about:blank', title: '' }], 'a')
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
        { tabId: 'live-1', url: 'about:blank', title: 'One', selected: true },
        { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false },
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
    const browserGoBack = vi.fn(async () => ({ url: 'https://prev.test', title: 'Prev' }))
    mount({ browserGoBack })
    await waitFor(() => { expect(screen.getByLabelText('后退')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('后退'))
    await waitFor(() => { expect(screen.getByDisplayValue('https://prev.test')).toBeTruthy() })
  })
})
