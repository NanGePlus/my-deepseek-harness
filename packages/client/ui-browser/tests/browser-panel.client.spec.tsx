// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  SessionId, SessionListState, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore, DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { BrowserPanel, type BrowserPanelProps } from '../src/client/BrowserPanel.tsx'
import { createBrowserPanelStore, browserWorkspaceState } from '../src/client/stores.ts'
import { formatBrowserZoomLabel } from '../src/client/browser-zoom.ts'
import { DEFAULT_BROWSER_TAB_URL } from '../src/client/browser-tab-title.ts'
import { zh } from '../src/client/locales.ts'

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
    revealBrowserSegment: over.revealBrowserSegment ?? vi.fn(),
  }
  const view = render(<BrowserPanel {...props} />)
  return {
    browserList,
    browserCreateTab,
    browserCloseTab,
    browserSelectTab,
    browserNavigate,
    browserGoBack,
    browserGoForward,
    browserReload,
    browserShowWindow,
    panelStore: panelStore!,
    sessionsStore,
    rerender: (next: Partial<BrowserPanelProps> = {}) => {
      view.rerender(<BrowserPanel {...props} {...next} />)
    },
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

  it('default: lists then auto-creates about:blank and raises the native window', async () => {
    const { browserList, browserCreateTab, browserShowWindow } = mount()
    await waitFor(() => { expect(browserList).toHaveBeenCalledWith(WID, expect.any(AbortSignal)) })
    await waitFor(() => {
      expect(browserCreateTab).toHaveBeenCalledWith(WID, DEFAULT_BROWSER_TAB_URL, expect.any(AbortSignal))
    })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalled() })
    expect(screen.getByText('在本机浏览器窗口中查看')).toBeTruthy()
    expect(screen.getByRole('tabpanel')).toBeTruthy()
  })

  it('default: reuses Host list rows instead of creating when tabs already exist', async () => {
    const { browserCreateTab, browserShowWindow } = mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
    })
    await waitFor(() => { expect(screen.getByRole('tablist')).toBeTruthy() })
    expect(browserCreateTab).not.toHaveBeenCalled()
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalledWith(WID, 'live-1', expect.any(AbortSignal)) })
  })

  it('US-8: focuses the address bar after the first automatic about:blank tab', async () => {
    mount()
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBe(document.activeElement) })
  })

  it('workspace binding: browserList uses the current session Workspace id', async () => {
    const WID2 = 'ws2' as WorkspaceId
    const { browserList } = mount({
      sessionId: 's2' as SessionId,
      items: [workspace(), workspace({ workspaceId: WID2, sessionIds: ['s2' as SessionId], title: 'beta' })],
    })
    await waitFor(() => { expect(browserList).toHaveBeenCalledWith(WID2, expect.any(AbortSignal)) })
  })

  it('US-6: switching Session shows the bound Workspace browser tab set', async () => {
    const WID2 = 'ws2' as WorkspaceId
    const SID2 = 's2' as SessionId
    const browserList = vi.fn(async (workspaceId: WorkspaceId) => ({
      tabs: workspaceId === WID
        ? [{ tabId: 'live-1', url: 'https://alpha.test', title: 'Alpha', selected: true, canGoBack: false, canGoForward: false }]
        : [{ tabId: 'live-2', url: 'https://beta.test', title: 'Beta', selected: true, canGoBack: false, canGoForward: false }],
    }))
    const { sessionsStore, rerender, panelStore } = mount({
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

  it('navigates from the address bar on Enter', async () => {
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
  })

  it('creates a new tab from the + control', async () => {
    const { browserCreateTab } = mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
      browserCreateTab: vi.fn(async () => ({ tabId: 'tab-2' })),
    })
    await waitFor(() => { expect(screen.getByLabelText('新建标签页')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('新建标签页'))
    await waitFor(() => {
      expect(browserCreateTab).toHaveBeenCalledWith(WID, DEFAULT_BROWSER_TAB_URL, expect.any(AbortSignal))
    })
  })

  it('rebuilds store tabs before + when the Host pool is empty', async () => {
    let hostGone = false
    const created: Array<{ tabId: string; url: string }> = []
    const browserList = vi.fn(async () => {
      if (created.length > 0) {
        return {
          tabs: created.map((row, index) => ({
            tabId: row.tabId,
            url: row.url,
            title: '',
            selected: index === created.length - 1,
            canGoBack: false,
            canGoForward: false,
          })),
        }
      }
      if (hostGone) return { tabs: [] }
      return {
        tabs: [
          {
            tabId: 'live-1',
            url: 'https://www.baidu.com/',
            title: 'Baidu',
            selected: true,
            canGoBack: false,
            canGoForward: false,
          },
          {
            tabId: 'live-2',
            url: 'https://chat.deepseek.com/',
            title: 'DeepSeek',
            selected: false,
            canGoBack: false,
            canGoForward: false,
          },
        ],
      }
    })
    const browserCreateTab = vi.fn(async (_workspaceId: WorkspaceId, url?: string) => {
      const tabId = `new-${String(created.length + 1)}`
      created.push({ tabId, url: url ?? DEFAULT_BROWSER_TAB_URL })
      return { tabId }
    })
    mount({ browserList, browserCreateTab })
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Baidu/ })).toBeTruthy() })
    hostGone = true
    fireEvent.click(screen.getByLabelText('新建标签页'))
    await waitFor(() => {
      expect(browserCreateTab).toHaveBeenCalledWith(WID, 'https://www.baidu.com/', expect.any(AbortSignal))
      expect(browserCreateTab).toHaveBeenCalledWith(WID, 'https://chat.deepseek.com/', expect.any(AbortSignal))
      expect(browserCreateTab).toHaveBeenCalledWith(WID, DEFAULT_BROWSER_TAB_URL, expect.any(AbortSignal))
    })
  })

  it('forwards back, forward, and reload through Host RPC', async () => {
    const { browserGoBack, browserGoForward, browserReload } = mount({
      browserList: vi.fn(async () => ({
        tabs: [{ ...BLANK_TAB, canGoBack: true, canGoForward: true }],
      })),
    })
    await waitFor(() => { expect(screen.getByLabelText('后退')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('后退'))
    fireEvent.click(screen.getByLabelText('前进'))
    fireEvent.click(screen.getByLabelText('刷新'))
    await waitFor(() => { expect(browserGoBack).toHaveBeenCalled() })
    expect(browserGoForward).toHaveBeenCalled()
    expect(browserReload).toHaveBeenCalled()
  })

  it('closes a tab when more than one tab exists', async () => {
    const { browserCloseTab } = mount({
      browserList: vi.fn(async () => ({
        tabs: [
          { ...BLANK_TAB, title: 'One' },
          { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
        ],
      })),
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: /One/ })).toBeTruthy() })
    fireEvent.click(screen.getAllByLabelText('关闭')[0]!)
    await waitFor(() => { expect(browserCloseTab).toHaveBeenCalledWith(WID, 'live-1', expect.any(AbortSignal)) })
  })

  it('selects another tab and raises its window', async () => {
    const { browserSelectTab, browserShowWindow } = mount({
      browserList: vi.fn(async () => ({
        tabs: [
          { ...BLANK_TAB, title: 'One' },
          { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
        ],
      })),
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Two' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    await waitFor(() => { expect(browserSelectTab).toHaveBeenCalledWith(WID, 'live-2', expect.any(AbortSignal)) })
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalledWith(WID, 'live-2', expect.any(AbortSignal)) })
  })

  it('surfaces navigation failures inline', async () => {
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
    expect(screen.getByRole('tablist')).toBeTruthy()
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

  it('does not auto-create when the Browser segment is hidden', async () => {
    const { browserCreateTab, rerender } = mount({ visible: false })
    await act(async () => { await Promise.resolve() })
    expect(browserCreateTab).not.toHaveBeenCalled()
    rerender({ visible: true })
    await waitFor(() => { expect(browserCreateTab).toHaveBeenCalled() })
  })

  it('ignores empty address submissions', async () => {
    const { browserNavigate } = mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
    })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    expect(browserNavigate).not.toHaveBeenCalled()
  })

  it('swallows DirectoryBrowseError when closing or selecting tabs', async () => {
    const browseError = new DirectoryBrowseError({
      code: 'browser-tab-not-found',
      message: 'gone',
      details: { workspaceId: WID, tabId: 'live-1' },
    })
    const { browserCloseTab, browserSelectTab } = mount({
      browserList: vi.fn(async () => ({
        tabs: [
          { ...BLANK_TAB, title: 'One' },
          { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
        ],
      })),
      browserCloseTab: vi.fn(async () => Promise.reject(browseError)),
      browserSelectTab: vi.fn(async () => Promise.reject(browseError)),
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: /One/ })).toBeTruthy() })
    fireEvent.click(screen.getAllByLabelText('关闭')[0]!)
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    await waitFor(() => { expect(browserCloseTab).toHaveBeenCalled() })
    await waitFor(() => { expect(screen.queryByRole('tab', { name: /One/ })).toBeNull() })
    expect(screen.getByRole('tab', { name: 'Two' })).toBeTruthy()
    expect(browserSelectTab).toHaveBeenCalled()
  })

  it('disabled-last-tab: hides close affordance when only one tab remains', async () => {
    mount({ browserList: vi.fn(async () => ({ tabs: [{ ...BLANK_TAB, title: 'Only' }] })) })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Only' })).toBeTruthy() })
    expect(screen.queryByLabelText('关闭')).toBeNull()
  })

  it('nav-disabled-history: disables back and forward without history', async () => {
    mount({ browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })) })
    await waitFor(() => { expect(screen.getByLabelText('后退')).toBeTruthy() })
    expect((screen.getByLabelText('后退') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('前进') as HTMLButtonElement).disabled).toBe(true)
  })

  it('US-10: closes tabs from the context menu while keeping at least one tab', async () => {
    const { browserCloseTab } = mount({
      browserList: vi.fn(async () => ({
        tabs: [
          { ...BLANK_TAB, title: 'One' },
          { tabId: 'live-2', url: 'about:blank', title: 'Two', selected: false, canGoBack: false, canGoForward: false },
        ],
      })),
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: /One/ })).toBeTruthy() })
    fireEvent.contextMenu(screen.getByRole('tab', { name: /One/ }))
    fireEvent.click(await screen.findByText('关闭其他'))
    await waitFor(() => { expect(browserCloseTab).toHaveBeenCalledWith(WID, 'live-2', expect.any(AbortSignal)) })
  })

  it('US-15: opens the current tab URL in the external browser', async () => {
    const opened: string[] = []
    const originalOpen = window.open
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
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
    })
    await waitFor(() => { expect(screen.getByLabelText('在外部浏览器打开')).toBeTruthy() })
    fireEvent.click(screen.getByLabelText('在外部浏览器打开'))
    expect(opened).toEqual(['https://example.com'])
    window.open = originalOpen
  })

  it('places nav icon tooltips below the buttons', async () => {
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
    })
    await waitFor(() => { expect(screen.getByLabelText('在外部浏览器打开')).toBeTruthy() })
    fireEvent.focus(screen.getByLabelText('在外部浏览器打开'))
    expect(screen.getByRole('tooltip').getAttribute('data-side')).toBe('bottom')
  })

  it('US-17: bootstrap browser-unavailable without tabs shows retry card and no tab chrome', async () => {
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

  it('US-13 / info-external: first non-localhost visit shows inline info without modal', async () => {
    const browserNavigate = vi.fn(async (_wid, _tabId, url: string) => ({
      url,
      title: 'Example',
      canGoBack: false,
      canGoForward: false,
    }))
    mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
      browserNavigate,
    })
    await waitFor(() => { expect(screen.getByLabelText('地址栏')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText('地址栏'), { target: { value: 'https://example.com' } })
    fireEvent.keyDown(screen.getByLabelText('地址栏'), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByText('正在访问外部站点')).toBeTruthy() })
    expect(screen.queryByRole('dialog')).toBeNull()
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
    expect(formatBrowserZoomLabel(1.25)).toBe('125%')
  })

  it('segment-hidden: hiding the Browser segment does not close Host tabs', async () => {
    const { browserCloseTab, browserShowWindow, rerender } = mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
    })
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalled() })
    rerender({ visible: false })
    expect(browserCloseTab).not.toHaveBeenCalled()
  })

  it('loading-reconnect: remount with persisted tabs calls Host list and raises the window', async () => {
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
    const browserCreateTab = vi.fn()
    const first = mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab,
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Example' })).toBeTruthy() })
    expect(browserCreateTab).not.toHaveBeenCalled()
    first.unmount()
    browserList.mockClear()
    const { browserShowWindow } = mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab,
    })
    await waitFor(() => { expect(browserList).toHaveBeenCalledWith(WID, expect.any(AbortSignal)) })
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalled() })
    expect(browserCreateTab).not.toHaveBeenCalled()
  })

  it('host-restart: empty Host list with persisted Client tabs recreates Host tabs then raises the window', async () => {
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
    const { browserShowWindow } = mount({
      useStore: hookOf(panelStore),
      actions: panelStore.actions,
      browserList,
      browserCreateTab,
    })
    await waitFor(() => { expect(browserCreateTab).toHaveBeenCalled() })
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalledWith(WID, 'live-1', expect.any(AbortSignal)) })
  })

  it('show-window button raises the headed Chromium window again', async () => {
    const { browserShowWindow } = mount({
      browserList: vi.fn(async () => ({ tabs: [BLANK_TAB] })),
    })
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalled() })
    browserShowWindow.mockClear()
    fireEvent.click(screen.getByText('显示窗口'))
    await waitFor(() => { expect(browserShowWindow).toHaveBeenCalled() })
  })
})
