// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionId, WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceEntry, WorkspaceEntriesListing } from '@deepseek-ai/dsh-client-runtime/client'
import { EditorSurface, type EditorSurfaceProps } from '../src/client/EditorSurface.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => { vi.stubGlobal('ResizeObserver', ResizeObserverStub) })
afterEach(() => { vi.unstubAllGlobals() })

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

function entry(
  name: string,
  isDirectory: boolean,
  hidden = name.startsWith('.'),
): WorkspaceEntry {
  return { name, path: `${ROOT}/${name}`, isDirectory, hidden }
}

const DEFAULT_ROOT: WorkspaceEntry[] = [
  entry('.git', true),
  entry('.gitignore', false),
  entry('node_modules', true),
  entry('README.md', false),
  entry('gone.ts', false),
  entry('src', true),
  entry('untracked.ts', false),
]

const SRC_CHILDREN: WorkspaceEntry[] = [
  { name: 'app.ts', path: `${ROOT}/src/app.ts`, isDirectory: false, hidden: false },
]

function listingFor(path: string): WorkspaceEntriesListing {
  if (path === ROOT) return { path, entries: DEFAULT_ROOT, truncated: false }
  if (path === `${ROOT}/src`) return { path, entries: SRC_CHILDREN, truncated: false }
  if (path === `${ROOT}/.git` || path === `${ROOT}/node_modules`) {
    return { path, entries: [], truncated: false }
  }
  return { path, entries: [], truncated: false }
}

function workspacesState(items: WorkspaceView[]): WorkspaceListState {
  return {
    items,
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId: items[0]?.workspaceId,
  }
}

function mount(over: {
  items?: WorkspaceView[]
  sessionId?: SessionId
  list?: EditorSurfaceProps['listWorkspaceEntries']
  git?: EditorSurfaceProps['gitStatus']
} = {}) {
  const listWorkspaceEntries = vi.fn(over.list ?? (async (_id: WorkspaceId, path: string) => listingFor(path)))
  const gitStatus = vi.fn(over.git ?? (async () => ({
    entries: [
      { path: `${ROOT}/README.md`, letter: 'M' },
      { path: `${ROOT}/untracked.ts`, letter: 'U' },
      { path: `${ROOT}/gone.ts`, letter: 'D' },
    ],
  })))
  const items = over.items ?? [workspace()]
  const state = workspacesState(items)
  const props = {
    t: makeTranslate(zh),
    sessionId: over.sessionId ?? SID,
    useWorkspaces: ((select: (s: WorkspaceListState) => unknown) => select(state)) as EditorSurfaceProps['useWorkspaces'],
    listWorkspaceEntries,
    gitStatus,
  } as EditorSurfaceProps
  const view = render(<EditorSurface {...props} />)
  return { view, props, listWorkspaceEntries, gitStatus, state }
}

describe('EditorSurface file tree', () => {
  it('default: binds the Session Workspace, shows hidden paths, type icons, and Git letters', async () => {
    const b = mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.getByText('.git')).toBeTruthy()
    expect(screen.getByText('.gitignore')).toBeTruthy()
    expect(screen.getByText('node_modules')).toBeTruthy()
    expect(screen.getByRole('tree', { name: 'alpha' })).toBeTruthy()
    expect(screen.getAllByRole('img', { name: '文件夹' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('img', { name: '文件' }).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Git M').textContent).toBe('M')
    expect(screen.getByLabelText('Git U').textContent).toBe('U')
    expect(screen.getByLabelText('Git D').textContent).toBe('D')
    expect(screen.getByText('未打开文件')).toBeTruthy()
    expect(b.listWorkspaceEntries).toHaveBeenCalledWith(WID, ROOT, expect.any(AbortSignal))
    expect(b.listWorkspaceEntries.mock.calls.every(call => call[1] === ROOT)).toBe(true)
  })

  it('reloads the tree when the bound Workspace follows a new Session', async () => {
    const other = workspace({
      workspaceId: 'ws2' as WorkspaceId,
      path: '/w/beta',
      title: 'beta',
      sessionIds: ['s2' as SessionId],
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === '/w/beta') {
        return {
          path,
          entries: [{ name: 'only-beta.ts', path: '/w/beta/only-beta.ts', isDirectory: false, hidden: false }],
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const first = mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const nextState = workspacesState([workspace(), other])
    first.view.rerender(
      <EditorSurface
        {...first.props}
        sessionId={'s2' as SessionId}
        useWorkspaces={((select: (s: WorkspaceListState) => unknown) => select(nextState)) as EditorSurfaceProps['useWorkspaces']}
      />,
    )
    await waitFor(() => { expect(screen.getByText('only-beta.ts')).toBeTruthy() })
    expect(screen.queryByText('README.md')).toBeNull()
    expect(listWorkspaceEntries).toHaveBeenCalledWith('ws2', '/w/beta', expect.any(AbortSignal))
  })

  it('empty-workspace: shows the empty-directory copy and New file CTA', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => ({
      path, entries: [] as WorkspaceEntry[], truncated: false,
    }))
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('此目录为空')).toBeTruthy() })
    expect(screen.getAllByRole('button', { name: '新建文件' }).length).toBeGreaterThan(0)
    expect(screen.getByText('未打开文件')).toBeTruthy()
  })

  it('filter-no-match: narrows rows and shows a text clear control', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('按文件名过滤'), { target: { value: 'readme' } })
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.queryByText('untracked.ts')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('按文件名过滤'), { target: { value: 'zzz-nope' } })
    expect(screen.getByText('无匹配文件')).toBeTruthy()
    const clearButtons = screen.getAllByRole('button', { name: '清除过滤' })
    fireEvent.click(clearButtons[clearButtons.length - 1]!)
    expect(screen.getByText('untracked.ts')).toBeTruthy()
    expect(screen.queryByText('无匹配文件')).toBeNull()
  })

  it('loading-expand: fetches only the expanded layer and shows a row spinner', async () => {
    let release!: (listing: WorkspaceEntriesListing) => void
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string, _signal?: AbortSignal) => {
      if (path === ROOT) return Promise.resolve(listingFor(path))
      return new Promise<WorkspaceEntriesListing>((resolve) => { release = resolve })
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    expect(screen.queryByText('app.ts')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy() })
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === `${ROOT}/src`)).toHaveLength(1)
    await act(async () => { release(listingFor(`${ROOT}/src`)) })
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    expect(listWorkspaceEntries.mock.calls.map(call => call[1]).sort()).toEqual([ROOT, `${ROOT}/src`])
    fireEvent.click(screen.getByRole('button', { name: '折叠 src' }))
    expect(screen.queryByText('app.ts')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    expect(screen.getByText('app.ts')).toBeTruthy()
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === `${ROOT}/src`)).toHaveLength(1)
    fireEvent.change(screen.getByPlaceholderText('按文件名过滤'), { target: { value: 'app' } })
    expect(screen.getByText('src')).toBeTruthy()
    expect(screen.getByText('app.ts')).toBeTruthy()
    expect(screen.queryByText('README.md')).toBeNull()
  })

  it('loading-git: shows a tree-top progress bar without hiding rows', async () => {
    let release!: (listing: { entries: { path: string; letter: string }[] }) => void
    const gitStatus = vi.fn(() => new Promise<{ entries: { path: string; letter: string }[] }>((resolve) => {
      release = resolve
    }))
    mount({ git: gitStatus })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.getByRole('progressbar', { name: 'Git 状态加载中' })).toBeTruthy()
    expect(screen.queryByLabelText('Git M')).toBeNull()
    await act(async () => {
      release({ entries: [{ path: `${ROOT}/README.md`, letter: 'M' }] })
    })
    await waitFor(() => { expect(screen.getByLabelText('Git M')).toBeTruthy() })
    expect(screen.queryByRole('progressbar', { name: 'Git 状态加载中' })).toBeNull()
  })

  it('git-non-repo: keeps the tree and omits badges and errors', async () => {
    const gitStatus = vi.fn(async () => ({ entries: [] }))
    mount({ git: gitStatus })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.queryByLabelText(/^Git /)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('still lists a large directory through the scrollable tree', async () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      name: `file-${String(index).padStart(3, '0')}.ts`,
      path: `${ROOT}/file-${String(index).padStart(3, '0')}.ts`,
      isDirectory: false,
      hidden: false,
    }))
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => ({
      path, entries: many, truncated: false,
    }))
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('file-000.ts')).toBeTruthy() })
    const scroller = document.querySelector('[data-tree-scroll="true"]')
    expect(scroller).not.toBeNull()
  })

  it('treats a thrown gitStatus like a non-repo: tree stays, no badges', async () => {
    const gitStatus = vi.fn(async () => {
      throw new Error('wire down')
    })
    mount({ git: gitStatus })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.queryByLabelText(/^Git /)).toBeNull()
  })

  it('keeps the pane usable when the root listing rejects', async () => {
    const listWorkspaceEntries = vi.fn(async () => {
      throw new Error('denied')
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByPlaceholderText('按文件名过滤')).toBeTruthy() })
    expect(screen.queryByText('README.md')).toBeNull()
  })

  it('does not list when the Session has no bound Workspace', async () => {
    const listWorkspaceEntries = vi.fn(async () => listingFor(ROOT))
    mount({ items: [], list: listWorkspaceEntries })
    expect(screen.getByPlaceholderText('按文件名过滤')).toBeTruthy()
    expect(listWorkspaceEntries).not.toHaveBeenCalled()
    expect(screen.getByText('未打开文件')).toBeTruthy()
  })

  it('does not fetch a file path on double-click', async () => {
    const b = mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.doubleClick(screen.getByText('README.md'))
    expect(b.listWorkspaceEntries.mock.calls.every(call => call[1] === ROOT)).toBe(true)
  })

  it('rolls back expansion when a folder listing rejects', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) return listingFor(path)
      throw new Error('unreadable')
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '展开 src' })).toBeTruthy()
    })
    expect(screen.queryByText('app.ts')).toBeNull()
  })

  it('selects a row on click', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const row = screen.getByText('README.md').closest('[role="treeitem"]')
    fireEvent.click(row!)
    expect(row!.getAttribute('aria-selected')).toBe('true')
  })

  it('does not apply a listing that settles after unmount', async () => {
    let releaseList!: (listing: WorkspaceEntriesListing) => void
    let releaseGit!: (listing: { entries: { path: string; letter: string }[] }) => void
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string) => {
      if (path !== ROOT) return Promise.resolve(listingFor(path))
      return new Promise<WorkspaceEntriesListing>((resolve) => { releaseList = resolve })
    })
    const gitStatus = vi.fn(() => new Promise<{ entries: { path: string; letter: string }[] }>((resolve) => {
      releaseGit = resolve
    }))
    const b = mount({ list: listWorkspaceEntries, git: gitStatus })
    b.view.unmount()
    await act(async () => {
      releaseList(listingFor(ROOT))
      releaseGit({ entries: [{ path: `${ROOT}/README.md`, letter: 'M' }] })
    })
  })

  it('ignores a folder listing that settles after unmount', async () => {
    let release!: (listing: WorkspaceEntriesListing) => void
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string) => {
      if (path === ROOT) return Promise.resolve(listingFor(path))
      return new Promise<WorkspaceEntriesListing>((resolve) => { release = resolve })
    })
    const b = mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    b.view.unmount()
    await act(async () => { release(listingFor(`${ROOT}/src`)) })
  })

  it('ignores a folder listing that rejects after unmount', async () => {
    let fail!: (error: unknown) => void
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string) => {
      if (path === ROOT) return Promise.resolve(listingFor(path))
      return new Promise<WorkspaceEntriesListing>((_resolve, reject) => { fail = reject })
    })
    const b = mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    b.view.unmount()
    await act(async () => { fail(new Error('gone')) })
  })

  it('swallows Host failures that settle after unmount', async () => {
    let failList!: (error: unknown) => void
    let failGit!: (error: unknown) => void
    const listWorkspaceEntries = vi.fn(() => new Promise<WorkspaceEntriesListing>((_resolve, reject) => {
      failList = reject
    }))
    const gitStatus = vi.fn(() => new Promise<{ entries: { path: string; letter: string }[] }>((_resolve, reject) => {
      failGit = reject
    }))
    const b = mount({ list: listWorkspaceEntries, git: gitStatus })
    b.view.unmount()
    await act(async () => {
      failList(new Error('list'))
      failGit(new Error('git'))
    })
  })
})
