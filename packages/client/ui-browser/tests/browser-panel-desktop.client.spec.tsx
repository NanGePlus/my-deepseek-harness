// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  BrowserPageMetadata,
  SessionId, SessionListState, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore, DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { BrowserPanel, type BrowserPanelProps } from '../src/client/BrowserPanel.tsx'
import { createBrowserPanelStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (typeof localStorage !== 'undefined') localStorage.removeItem('dsh.browser.panel.v1')
})

const BLANK_PAGE = { url: 'about:blank', title: '', canGoBack: false, canGoForward: false } as const
const BLANK_TAB = { tabId: 'live-1', url: 'about:blank', title: '', selected: true, canGoBack: false, canGoForward: false } as const
const SID = 's1' as SessionId
const WID = 'ws1' as WorkspaceId

class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback
  observed: Element[] = []
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(element: Element): void {
    this.observed.push(element)
    this.callback([], this as unknown as ResizeObserver)
  }
  disconnect(): void { this.observed = [] }
}

function workspace(over: Partial<WorkspaceView> = {}): WorkspaceView {
  return {
    workspaceId: WID,
    path: '/w/alpha',
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

function stubDesktop(reportBounds = vi.fn()) {
  vi.stubGlobal('dsh', {
    delivery: 'desktop',
    reportBrowserOccupantBounds: reportBounds,
  })
  return reportBounds
}

type MountOverrides = Partial<BrowserPanelProps> & {
  items?: WorkspaceView[]
  sessionId?: SessionId
  noCurrentSession?: boolean
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
  const browserShowWindow = vi.fn(over.browserShowWindow ?? (async () => ({ shown: true as const })))
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
    browserShowWindow,
    ...over,
  }
  const view = render(<BrowserPanel {...props} />)
  return {
    browserList,
    browserCreateTab,
    browserCloseTab,
    browserSelectTab,
    browserNavigate,
    browserShowWindow,
    panelStore: panelStore!,
    rerender: (next: Partial<BrowserPanelProps> = {}) => {
      view.rerender(<BrowserPanel {...props} {...next} />)
    },
    unmount: view.unmount,
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

describe('BrowserPanel desktop occupant', () => {
  it('fake desktop: omits show-window copy and never calls browserShowWindow', async () => {
    stubDesktop()
    const { browserShowWindow } = mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
    })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    expect(screen.queryByText('显示窗口')).toBeNull()
    expect(screen.queryByText('在本机浏览器窗口中查看')).toBeNull()
    expect(browserShowWindow).not.toHaveBeenCalled()
  })

  it('renders #browser-occupant and reports screen bounds when visible', async () => {
    const reportBounds = stubDesktop()
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 12, y: 34, width: 640, height: 480, top: 34, left: 12, right: 652, bottom: 514 }),
    })
    mount({ browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })) })
    await waitFor(() => { expect(document.getElementById('browser-occupant')).toBeTruthy() })
    await waitFor(() => {
      expect(reportBounds).toHaveBeenCalledWith({
        x: 12,
        y: 34,
        width: 640,
        height: 480,
        visible: true,
      })
    })
  })

  it('keeps V4 navigation and tab chrome on fake desktop', async () => {
    stubDesktop()
    const browserNavigate = vi.fn(async (_wid, _tabId, url: string) => ({
      url, title: 'Example', canGoBack: false, canGoForward: false,
    }))
    mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
      browserNavigate,
    })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => {
      expect(browserNavigate).toHaveBeenCalledWith(WID, 'live-1', 'https://example.com/', expect.any(AbortSignal))
    })
    fireEvent.click(screen.getByLabelText('新建标签页'))
    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeTruthy()
    })
  })

  it('segment hidden: reports visible=false and preserves Host tabs', async () => {
    const reportBounds = stubDesktop()
    const { browserCloseTab, rerender } = mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
    })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    reportBounds.mockClear()
    rerender({ visible: false })
    await waitFor(() => {
      expect(reportBounds).toHaveBeenCalledWith({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        visible: false,
      })
    })
    expect(browserCloseTab).not.toHaveBeenCalled()
  })

  it('empty-unbound: shows 无法使用浏览器 without tab chrome on desktop', () => {
    stubDesktop()
    mount({ noCurrentSession: true, items: [workspace({ sessionIds: [] })] })
    expect(screen.getByText('无法使用浏览器')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText('显示窗口')).toBeNull()
  })

  it('loading: shows preparing copy before Host tabs are ready', async () => {
    stubDesktop()
    let resolveList!: (value: { tabs: typeof BLANK_TAB[] }) => void
    const browserList = vi.fn(() => new Promise<{ tabs: typeof BLANK_TAB[] }>((resolve) => {
      resolveList = resolve
    }))
    mount({ browserList })
    expect(screen.getByText('正在准备浏览器…')).toBeTruthy()
    resolveList({ tabs: [BLANK_TAB] })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    expect(screen.queryByText('正在准备浏览器…')).toBeNull()
  })

  it('loading: shows aria-busy occupant while navigation is in flight', async () => {
    stubDesktop()
    let resolveNav!: (value: BrowserPageMetadata) => void
    const browserNavigate = vi.fn(() => new Promise<BrowserPageMetadata>((resolve) => {
      resolveNav = resolve
    }))
    mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
      browserNavigate,
    })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByRole('tabpanel').getAttribute('aria-busy')).toBe('true')
    })
    resolveNav({ url: 'https://example.com/', title: 'Example', canGoBack: false, canGoForward: false })
    await waitFor(() => {
      expect(screen.getByRole('tabpanel').getAttribute('aria-busy')).toBe('false')
    })
  })

  it('nav-error: surfaces inline error and occupant failure copy on desktop', async () => {
    stubDesktop()
    const browserNavigate = vi.fn(async () => Promise.reject(new Error('dns failed')))
    mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
      browserNavigate,
    })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://missing.example' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByText('dns failed')).toBeTruthy() })
    expect(screen.getByText('无法加载此页')).toBeTruthy()
    expect(document.getElementById('browser-occupant')).toBeTruthy()
    expect(screen.queryByText('显示窗口')).toBeNull()
  })

  it('unavailable: bootstrap failure shows retry card without show-window chrome', async () => {
    stubDesktop()
    const browserCreateTab = vi.fn(async () => Promise.reject(new DirectoryBrowseError({
      code: 'browser-unavailable',
      message: '无法启动浏览器',
      details: { reason: 'context-start-failed' },
    })))
    mount({ browserCreateTab })
    await waitFor(() => { expect(screen.getByText('浏览器不可用')).toBeTruthy() })
    expect(screen.getByText('无法启动浏览器')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText('显示窗口')).toBeNull()
  })

  it('hard refresh: remount restores tab bar from store without browserShowWindow', async () => {
    stubDesktop()
    const panelStore = createBrowserPanelStore().create()
    panelStore.actions.setWorkspaceTabs(WID, [{
      tabId: 'live-1',
      url: 'https://example.com',
      title: 'Example',
      canGoBack: false,
      canGoForward: false,
    }], 'live-1')
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
    const browserShowWindow = vi.fn(async () => ({ shown: true as const }))
    const first = mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserShowWindow,
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy() })
    first.unmount()
    browserList.mockClear()
    browserShowWindow.mockClear()
    mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserShowWindow,
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy() })
    expect(browserShowWindow).not.toHaveBeenCalled()
    expect(browserList).toHaveBeenCalledWith(WID, expect.any(AbortSignal))
  })

  it('host-restart: empty Host list with persisted Client tabs recreates tabs on desktop', async () => {
    stubDesktop()
    const panelStore = createBrowserPanelStore().create()
    panelStore.actions.setWorkspaceTabs(WID, [{
      tabId: 'stale-1',
      url: 'https://example.com',
      title: 'Example',
      canGoBack: false,
      canGoForward: false,
    }], 'stale-1')
    const browserList = vi.fn()
      .mockResolvedValueOnce({ tabs: [] })
      .mockResolvedValue({
        tabs: [{
          tabId: 'live-1',
          url: 'https://example.com',
          title: 'Example',
          selected: true,
          canGoBack: false,
          canGoForward: false,
        }],
      })
    const browserCreateTab = vi.fn(async () => ({ tabId: 'live-1' }))
    const browserShowWindow = vi.fn(async () => ({ shown: true as const }))
    mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab,
      browserShowWindow,
    })
    await waitFor(() => { expect(browserCreateTab).toHaveBeenCalled() })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy() })
    expect(browserShowWindow).not.toHaveBeenCalled()
  })
})
