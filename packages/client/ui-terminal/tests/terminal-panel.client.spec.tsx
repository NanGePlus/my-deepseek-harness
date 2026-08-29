// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  SessionId, SessionListState, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError, createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { TerminalPanel, type TerminalPanelProps } from '../src/client/TerminalPanel.tsx'
import { createTerminalPanelStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'
import { DARK_ATTRIBUTE } from '../src/client/use-harness-dark.ts'

vi.mock('../src/client/xterm-viewport.ts', () => import('./xterm-viewport.stub.ts'))

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
  document.body.removeAttribute(DARK_ATTRIBUTE)
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

type MountOverrides = Partial<TerminalPanelProps> & {
  items?: WorkspaceView[]
  noCurrentSession?: boolean
  sessionId?: SessionId
}

function mount(over: MountOverrides = {}) {
  const terminalProfiles = vi.fn(over.terminalProfiles ?? (async () => ({
    profiles: [{ id: 'zsh', name: 'zsh' }],
    defaultProfileId: 'zsh',
  })))
  const terminalList = vi.fn(over.terminalList ?? (async () => ({ sessions: [] })))
  const terminalSpawn = vi.fn(over.terminalSpawn ?? (async () => ({ sessionId: 'term-1' })))
  const terminalWrite = vi.fn(over.terminalWrite ?? (async () => ({ written: true as const })))
  const terminalResize = vi.fn(over.terminalResize ?? (async () => ({ resized: true as const })))
  const terminalStream = vi.fn<TerminalPanelProps['terminalStream']>(over.terminalStream ?? ((
    _workspaceId,
    _sessionId,
    onFrame,
    _signal,
    onOpen,
  ) => {
    onOpen?.()
    onFrame({ type: 'host/terminal-scrollback', text: '$ ', truncated: false })
  }))
  const items = over.items ?? [workspace()]
  const workspacesStore = createSnapshotStore(workspacesState(items))
  const sessionsStore = createSnapshotStore(sessionsState(
    over.noCurrentSession ? undefined : (over.sessionId ?? SID),
  ))
  const panelStore = createTerminalPanelStore().create()
  const props: TerminalPanelProps = {
    visible: over.visible ?? true,
    t: makeTranslate(zh),
    useSessions: hookOf(sessionsStore),
    useWorkspaces: hookOf(workspacesStore),
    useStore: hookOf(panelStore),
    actions: panelStore.actions,
    terminalProfiles,
    terminalList,
    terminalSpawn,
    terminalWrite,
    terminalResize,
    terminalStream,
    ...over,
  }
  const view = render(<TerminalPanel {...props} />)
  const host = view.container.querySelector('[role="tabpanel"]')
  if (host instanceof HTMLElement) {
    Object.defineProperty(host, 'clientWidth', { value: 400 })
    Object.defineProperty(host, 'clientHeight', { value: 300 })
  }
  return {
    terminalProfiles,
    terminalList,
    terminalSpawn,
    terminalWrite,
    terminalResize,
    terminalStream,
    panelStore,
    unmount: view.unmount,
  }
}

describe('TerminalPanel', () => {
  it('empty-unbound: shows 无法使用终端 without tab chrome when no Workspace is bound', () => {
    mount({ noCurrentSession: true, items: [workspace({ sessionIds: [] })] })
    expect(screen.getByText('无法使用终端')).toBeTruthy()
    expect(screen.getByText('请先选择 Workspace 并开始会话。')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('disabled-unbound: does not call Host spawn when Workspace is unbound', () => {
    const { terminalSpawn, terminalList } = mount({ noCurrentSession: true, items: [] })
    expect(terminalSpawn).not.toHaveBeenCalled()
    expect(terminalList).not.toHaveBeenCalled()
  })

  it('default: lists then auto-spawns and renders a tab bar when Workspace is bound', async () => {
    const { terminalList, terminalSpawn, terminalProfiles } = mount()
    await waitFor(() => { expect(terminalList).toHaveBeenCalledWith(WID, expect.any(AbortSignal)) })
    await waitFor(() => { expect(terminalProfiles).toHaveBeenCalled() })
    await waitFor(() => {
      expect(terminalSpawn).toHaveBeenCalledWith(WID, 'zsh', ROOT, expect.any(AbortSignal))
    })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'zsh' })).toBeTruthy() })
  })

  it('default: reuses Host list rows instead of spawning when sessions already exist', async () => {
    const terminalList = vi.fn(async () => ({
      sessions: [{ sessionId: 'live-1', title: 'node', profileId: 'zsh' }],
    }))
    const terminalSpawn = vi.fn()
    mount({ terminalList, terminalSpawn })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'node' })).toBeTruthy() })
    expect(terminalSpawn).not.toHaveBeenCalled()
  })

  it('loading: shows 连接中… while SSE opens', async () => {
    const terminalStream = vi.fn<TerminalPanelProps['terminalStream']>((
      _workspaceId,
      _sessionId,
      _onFrame,
      _signal,
    ) => { /* defer onOpen */ })
    mount({ terminalStream })
    await waitFor(() => { expect(screen.getByText('连接中…')).toBeTruthy() })
  })

  it('workspace binding: terminalList uses the current session Workspace id', async () => {
    const WID2 = 'ws2' as WorkspaceId
    const terminalList = vi.fn(async () => ({ sessions: [] }))
    mount({
      terminalList,
      sessionId: 's2' as SessionId,
      items: [workspace(), workspace({ workspaceId: WID2, sessionIds: ['s2' as SessionId], title: 'beta' })],
    })
    await waitFor(() => { expect(terminalList).toHaveBeenCalledWith(WID2, expect.any(AbortSignal)) })
  })

  it('xterm input and resize: forwards stdin and cols/rows through Host RPC', async () => {
    const { createXtermViewport } = await import('./xterm-viewport.stub.ts')
    const { terminalWrite, terminalResize } = mount()
    await waitFor(() => { expect(createXtermViewport).toHaveBeenCalled() })
    const options = createXtermViewport.mock.calls.at(-1)?.[0]
    expect(options).toBeDefined()
    options!.onInput('ls\n')
    options!.onResize(120, 30)
    await waitFor(() => {
      expect(terminalWrite).toHaveBeenCalledWith(WID, 'term-1', 'ls\n')
      expect(terminalResize).toHaveBeenCalledWith(WID, 'term-1', 120, 30)
    })
  })

  it('theme-follow: xterm viewport receives dark refreshes from body[data-ds-dark-theme]', async () => {
    const { createXtermViewport } = await import('./xterm-viewport.stub.ts')
    mount()
    await waitFor(() => { expect(createXtermViewport).toHaveBeenCalled() })
    await act(async () => { document.body.setAttribute(DARK_ATTRIBUTE, '') })
    await waitFor(() => {
      const handle = createXtermViewport.mock.results.at(-1)?.value as { setDark: ReturnType<typeof vi.fn> }
      expect(handle.setDark).toHaveBeenCalledWith(true)
    })
  })

  it('does not spawn when the Terminal segment is hidden', async () => {
    const { terminalSpawn } = mount({ visible: false })
    await act(async () => { await Promise.resolve() })
    expect(terminalSpawn).not.toHaveBeenCalled()
  })

  it('stream title frames rename the active tab', async () => {
    const terminalStream = vi.fn<TerminalPanelProps['terminalStream']>((
      _workspaceId,
      _sessionId,
      onFrame,
      _signal,
      onOpen,
    ) => {
      onOpen?.()
      onFrame({ type: 'host/terminal-title', title: 'remote-title' })
    })
    mount({ terminalStream })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'remote-title' })).toBeTruthy() })
  })

  it('stream output frames write into the xterm viewport', async () => {
    const { createXtermViewport } = await import('./xterm-viewport.stub.ts')
    const terminalStream = vi.fn<TerminalPanelProps['terminalStream']>((
      _workspaceId,
      _sessionId,
      onFrame,
      _signal,
      onOpen,
    ) => {
      onOpen?.()
      onFrame({ type: 'host/terminal-output', text: 'pwd\n' })
    })
    mount({ terminalStream })
    await waitFor(() => { expect(createXtermViewport).toHaveBeenCalled() })
    const handle = createXtermViewport.mock.results.at(-1)?.value as { write: ReturnType<typeof vi.fn> }
    await waitFor(() => { expect(handle.write).toHaveBeenCalledWith('pwd\n') })
  })

  it('selecting another tab switches the active session id', async () => {
    const terminalList = vi.fn(async () => ({
      sessions: [
        { sessionId: 'live-1', title: 'first', profileId: 'zsh' },
        { sessionId: 'live-2', title: 'second', profileId: 'zsh' },
      ],
    }))
    mount({ terminalList })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'second' })).toBeTruthy() })
    await act(async () => { screen.getByRole('tab', { name: 'second' }).click() })
    expect(screen.getByRole('tab', { name: 'second' }).getAttribute('aria-selected')).toBe('true')
  })

  it('ignores DirectoryBrowseError from the initial list/spawn handshake', async () => {
    const terminalList = vi.fn(async () => {
      throw new DirectoryBrowseError({ code: 'workspace-not-found', message: 'missing workspace', details: {} })
    })
    mount({ terminalList })
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('rethrows unexpected Host errors from auto-spawn', async () => {
    const terminalSpawn = vi.fn(async () => { throw new Error('boom') })
    const onRejection = vi.fn()
    process.on('unhandledRejection', onRejection)
    mount({ terminalSpawn })
    await waitFor(() => { expect(terminalSpawn).toHaveBeenCalled() })
    await waitFor(() => { expect(onRejection).toHaveBeenCalled() })
    process.off('unhandledRejection', onRejection)
  })

  it('aborts the spawn handshake when the panel unmounts', async () => {
    vi.useFakeTimers()
    const terminalList = vi.fn(async () => {
      await vi.advanceTimersByTimeAsync(100)
      return { sessions: [] }
    })
    const terminalProfiles = vi.fn(async () => ({
      profiles: [{ id: 'zsh', name: 'zsh' }],
      defaultProfileId: 'zsh',
    }))
    const terminalSpawn = vi.fn(async () => ({ sessionId: 'late' }))
    const { unmount } = mount({ terminalList, terminalProfiles, terminalSpawn })
    unmount()
    await vi.advanceTimersByTimeAsync(500)
    expect(terminalSpawn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('uses the default profile id as the tab title when the profile row is missing', async () => {
    const terminalProfiles = vi.fn(async () => ({
      profiles: [{ id: 'bash', name: 'bash' }],
      defaultProfileId: 'zsh',
    }))
    mount({ terminalProfiles })
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'zsh' })).toBeTruthy() })
  })

  it('aborts before spawn when unmounted during profile fetch', async () => {
    vi.useFakeTimers()
    const terminalList = vi.fn(async () => ({ sessions: [] }))
    const terminalProfiles = vi.fn(async () => {
      await vi.advanceTimersByTimeAsync(200)
      return { profiles: [{ id: 'zsh', name: 'zsh' }], defaultProfileId: 'zsh' }
    })
    const terminalSpawn = vi.fn(async () => ({ sessionId: 'late' }))
    const { unmount } = mount({ terminalList, terminalProfiles, terminalSpawn })
    await vi.advanceTimersByTimeAsync(50)
    unmount()
    await vi.advanceTimersByTimeAsync(500)
    expect(terminalSpawn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('aborts before tab insert when unmounted during spawn', async () => {
    vi.useFakeTimers()
    const terminalSpawn = vi.fn(async () => {
      await vi.advanceTimersByTimeAsync(200)
      return { sessionId: 'late' }
    })
    const { unmount, panelStore } = mount({ terminalSpawn })
    await vi.advanceTimersByTimeAsync(100)
    unmount()
    await vi.advanceTimersByTimeAsync(500)
    expect(panelStore.getSnapshot().byWorkspace[WID]?.tabs ?? []).toHaveLength(0)
    vi.useRealTimers()
  })

  it('skips ResizeObserver wiring when the API is unavailable', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    mount()
    await act(async () => { await Promise.resolve() })
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  it('ResizeObserver reflow calls xterm fit', async () => {
    const { createXtermViewport } = await import('./xterm-viewport.stub.ts')
    mount()
    await waitFor(() => { expect(createXtermViewport).toHaveBeenCalled() })
    const handle = createXtermViewport.mock.results.at(-1)?.value as { fit: ReturnType<typeof vi.fn> }
    await waitFor(() => { expect(handle.fit).toHaveBeenCalled() })
  })

  it('restores another Workspace tab set from the store without re-spawning', async () => {
    const panelStore = createTerminalPanelStore().create()
    panelStore.actions.setWorkspaceTabs(WID, [{
      sessionId: 'persisted-1', title: 'bash', profileId: 'bash',
    }])
    const terminalSpawn = vi.fn()
    const workspacesStore = createSnapshotStore(workspacesState([workspace()]))
    const sessionsStore = createSnapshotStore(sessionsState(SID))
    render(
      <TerminalPanel
        visible
        t={makeTranslate(zh)}
        useSessions={hookOf(sessionsStore)}
        useWorkspaces={hookOf(workspacesStore)}
        useStore={hookOf(panelStore)}
        actions={panelStore.actions}
        terminalProfiles={vi.fn()}
        terminalList={vi.fn(async () => ({ sessions: [] }))}
        terminalSpawn={terminalSpawn}
        terminalWrite={vi.fn()}
        terminalResize={vi.fn()}
        terminalStream={vi.fn((_w, _s, _f, _sig, onOpen) => { onOpen?.() })}
      />,
    )
    expect(screen.getByRole('tab', { name: 'bash' })).toBeTruthy()
    expect(terminalSpawn).not.toHaveBeenCalled()
  })
})
