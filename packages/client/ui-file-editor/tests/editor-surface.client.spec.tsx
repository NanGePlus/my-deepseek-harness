// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  FileReadKind, FileReadResult, FileWriteResult, SessionId, SessionListState, WorkspaceId, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceEntry, WorkspaceEntriesListing } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore, DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { EditorSurface, editorDirtyGuard, type EditorSurfaceProps } from '../src/client/EditorSurface.tsx'
import { resetDirtyGuardForTest } from '../src/client/dirty-guard.ts'
import { createFileEditorStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
afterEach(() => { document.body.removeAttribute('data-ds-dark-theme') })
afterEach(() => { resetDirtyGuardForTest(editorDirtyGuard) })

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
  entry('app.wasm', false),
  entry('logo.png', false),
  entry('node_modules', true),
  entry('README.md', false),
  entry('gone.ts', false),
  entry('src', true),
  entry('untracked.ts', false),
]

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function saveShortcut(): void {
  fireEvent.keyDown(window, { key: 's', metaKey: true })
}

function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot))
  }
}

function defaultReadFile(_id: WorkspaceId, path: string, kind: FileReadKind): Promise<FileReadResult> {
  if (kind === 'bytes') {
    return Promise.resolve({ kind: 'bytes', path, data: PNG_BASE64, mediaType: 'image/png' })
  }
  return Promise.resolve({ kind: 'text', path, text: `contents of ${path}\n` })
}

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

function sessionsState(current: SessionId): SessionListState {
  return {
    ids: [current],
    byId: {},
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function mount(over: {
  items?: WorkspaceView[]
  sessionId?: SessionId
  list?: EditorSurfaceProps['listWorkspaceEntries']
  git?: EditorSurfaceProps['gitStatus']
  read?: EditorSurfaceProps['readFile']
  write?: EditorSurfaceProps['writeFile']
  deletePath?: EditorSurfaceProps['deletePath']
  renamePath?: EditorSurfaceProps['renamePath']
  createWorkspaceDirectory?: EditorSurfaceProps['createWorkspaceDirectory']
  watchPath?: EditorSurfaceProps['watchPath']
} = {}) {
  const listWorkspaceEntries = vi.fn(over.list ?? (async (_id: WorkspaceId, path: string) => listingFor(path)))
  const gitStatus = vi.fn(over.git ?? (async () => ({
    entries: [
      { path: `${ROOT}/README.md`, letter: 'M' },
      { path: `${ROOT}/untracked.ts`, letter: 'U' },
      { path: `${ROOT}/gone.ts`, letter: 'D' },
    ],
  })))
  const readFile = vi.fn(over.read ?? defaultReadFile)
  const writeFile = vi.fn(over.write ?? (async (_id: WorkspaceId, path: string, _text: string): Promise<FileWriteResult> => ({ path })))
  const deletePath = vi.fn(over.deletePath ?? (async (_id: WorkspaceId, path: string) => ({ path })))
  const renamePath = vi.fn(over.renamePath ?? (async (_id: WorkspaceId, path: string, newName: string) => ({
    path: path.replace(/[^/]+$/, newName),
  })))
  const createWorkspaceDirectory = vi.fn(over.createWorkspaceDirectory ?? (async (_id: WorkspaceId, parent: string, name: string) => ({
    path: `${parent}/${name}`,
  })))
  const watchPath = vi.fn(over.watchPath ?? (() => {}))
  const items = over.items ?? [workspace()]
  const workspacesStore = createSnapshotStore(workspacesState(items))
  const sessionsStore = createSnapshotStore(sessionsState(over.sessionId ?? SID))
  const instance = createFileEditorStore().create()
  const props = {
    t: makeTranslate(zh),
    useSessions: hookOf(sessionsStore),
    useWorkspaces: hookOf(workspacesStore),
    useStore: hookOf(instance),
    actions: instance.actions,
    listWorkspaceEntries,
    gitStatus,
    readFile,
    writeFile,
    deletePath,
    renamePath,
    createWorkspaceDirectory,
    watchPath,
    dirtyGuard: editorDirtyGuard,
  } as EditorSurfaceProps
  const view = render(<EditorSurface {...props} />)
  return {
    view, props, instance, sessionsStore, workspacesStore, listWorkspaceEntries, gitStatus, readFile, writeFile,
    deletePath, renamePath, createWorkspaceDirectory, watchPath,
  }
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

  it('collapses and expands the file tree from the hide and show controls', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '隐藏文件树' }))
    expect(screen.queryByRole('tree', { name: 'alpha' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '显示文件树' }))
    await waitFor(() => { expect(screen.getByRole('tree', { name: 'alpha' })).toBeTruthy() })
  })

  it('shows a draggable split handle between the tree and editor', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.getByRole('separator', { name: '调整文件树宽度' })).toBeTruthy()
  })

  it('does not reload the tree when switching Sessions within the same Workspace', async () => {
    const otherSid = 's2' as SessionId
    const shared = workspace({ sessionIds: [SID, otherSid] })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => listingFor(path))
    const b = mount({ items: [shared], list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const callsAfterLoad = listWorkspaceEntries.mock.calls.length
    fireEvent.click(screen.getByText('src').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    b.sessionsStore.update((s) => { s.current = otherSid })
    b.view.rerender(<EditorSurface {...b.props} />)
    expect(screen.getByText('src')).toBeTruthy()
    expect(screen.getByText('app.ts')).toBeTruthy()
    expect(listWorkspaceEntries.mock.calls.length).toBe(callsAfterLoad + 1)
  })

  it('keeps open editor tabs when switching Sessions within the same Workspace', async () => {
    const otherSid = 's2' as SessionId
    const shared = workspace({ sessionIds: [SID, otherSid] })
    const b = mount({ items: [shared] })
    const tree = await waitFor(() => screen.getByRole('tree', { name: 'alpha' }))
    fireEvent.click(within(tree).getByText('README.md').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    b.sessionsStore.update((s) => { s.current = otherSid })
    b.view.rerender(<EditorSurface {...b.props} />)
    expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy()
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
    const nextWorkspaces = createSnapshotStore(workspacesState([workspace(), other]))
    first.sessionsStore.update((s) => { s.current = 's2' as SessionId })
    first.view.rerender(
      <EditorSurface {...first.props} useWorkspaces={hookOf(nextWorkspaces)} />,
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

  it('expands and collapses a folder on a single row click', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByText('src').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    fireEvent.click(screen.getByText('src').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.queryByText('app.ts')).toBeNull() })
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

describe('EditorSurface open / save', () => {
  async function clickFile(name: string): Promise<void> {
    const tree = await waitFor(() => screen.getByRole('tree', { name: 'alpha' }))
    fireEvent.click(within(tree).getByText(name).closest('[role="treeitem"]')!)
  }

  it('default-editable: opening text shows a tab and language highlighting', async () => {
    const b = mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    expect(screen.queryByText('未打开文件')).toBeNull()
    expect(screen.getByRole('textbox', { name: /README\.md.*Markdown/ })).toBeTruthy()
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md.*Markdown/ }).value)
      .toBe('contents of /w/alpha/README.md\n')
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(b.readFile).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'text', expect.any(AbortSignal))
  })

  it('default-preview: opening an image shows a read-only preview', async () => {
    const b = mount()
    await clickFile('logo.png')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /logo\.png/ })).toBeTruthy() })
    const preview = screen.getByRole<HTMLImageElement>('img', { name: 'logo.png' })
    expect(preview.src).toContain(`data:image/png;base64,${PNG_BASE64}`)
    expect(screen.queryByRole('textbox', { name: /logo\.png/ })).toBeNull()
    expect(screen.queryByLabelText('未保存')).toBeNull()
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(b.readFile).toHaveBeenCalledWith(WID, `${ROOT}/logo.png`, 'bytes', expect.any(AbortSignal))
    expect(b.writeFile).not.toHaveBeenCalled()
  })

  it('non-openable: a known binary shows the hint and does not read the file', async () => {
    const b = mount()
    await clickFile('app.wasm')
    await waitFor(() => { expect(screen.getByText('不支持打开此文件类型')).toBeTruthy() })
    expect(screen.getByRole('tab', { name: /app\.wasm/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(b.readFile).not.toHaveBeenCalled()
  })

  it('empty-no-tabs: the unopened-file empty state remains until a file is opened', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.getByText('未打开文件')).toBeTruthy()
    expect(screen.getByText('从左侧文件树选择文件，或新建文件')).toBeTruthy()
    expect(screen.queryByRole('tablist', { name: '编辑器标签页' })).toBeNull()
    fireEvent.keyDown(window, { key: 's', metaKey: true })
  })

  it('dirty-unsaved: editing shows a dirty mark; ⌘S writes and clears it', async () => {
    const b = mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md.*Markdown/ })).toBeTruthy() })
    const box = screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md.*Markdown/ })
    fireEvent.change(box, { target: { value: 'edited readme\n' } })
    await waitFor(() => { expect(screen.getByLabelText('未保存')).toBeTruthy() })
    saveShortcut()
    await waitFor(() => { expect(screen.queryByLabelText('未保存')).toBeNull() })
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'edited readme\n', expect.any(AbortSignal))
    const again = screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md.*Markdown/ })
    fireEvent.change(again, { target: { value: 'again\n' } })
    await waitFor(() => { expect(screen.getByLabelText('未保存')).toBeTruthy() })
    saveShortcut()
    await waitFor(() => { expect(screen.queryByLabelText('未保存')).toBeNull() })
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'again\n', expect.any(AbortSignal))
  })

  it('save-disabled: a clean text tab, preview tab, and non-openable tab ignore save shortcuts', async () => {
    const b = mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    saveShortcut()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    fireEvent.keyDown(window, { key: 's' })
    expect(b.writeFile).not.toHaveBeenCalled()
    await clickFile('logo.png')
    await waitFor(() => { expect(screen.getByRole('img', { name: 'logo.png' })).toBeTruthy() })
    saveShortcut()
    await clickFile('app.wasm')
    await waitFor(() => { expect(screen.getByText('不支持打开此文件类型')).toBeTruthy() })
    saveShortcut()
    expect(b.writeFile).not.toHaveBeenCalled()
  })

  it('switches among multiple tabs without re-reading an already open file', async () => {
    const b = mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    await clickFile('untracked.ts')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /untracked\.ts.*TypeScript/ })).toBeTruthy() })
    expect(b.readFile).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('tab', { name: /README\.md/ }))
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md.*Markdown/ })).toBeTruthy() })
    await clickFile('README.md')
    expect(b.readFile).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    await waitFor(() => { expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull() })
    expect(screen.getByRole('textbox', { name: /untracked\.ts.*TypeScript/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭 untracked.ts' }))
    await waitFor(() => { expect(screen.getByText('未打开文件')).toBeTruthy() })
  })

  it('does not open a folder row as a tab', async () => {
    const b = mount()
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByText('src').closest('[role="treeitem"]')!)
    expect(b.readFile).not.toHaveBeenCalled()
    expect(screen.getByText('未打开文件')).toBeTruthy()
  })

  it('closes a background tab without changing the active buffer', async () => {
    mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    await clickFile('untracked.ts')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /untracked\.ts/ })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    expect(screen.getByRole('textbox', { name: /untracked\.ts/ })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull()
  })

  it('does not save when the Session no longer has a Workspace', async () => {
    const b = mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md/ })).toBeTruthy() })
    fireEvent.change(screen.getByRole('textbox', { name: /README\.md/ }), { target: { value: 'x\n' } })
    b.workspacesStore.update((draft) => { draft.items = [] })
    b.view.rerender(<EditorSurface {...b.props} />)
    saveShortcut()
    expect(b.writeFile).not.toHaveBeenCalled()
  })

  it('ignores a preview open that settles after unmount', async () => {
    let release!: (result: FileReadResult) => void
    const b = mount({
      read: () => new Promise<FileReadResult>((resolve) => { release = resolve }),
    })
    await clickFile('logo.png')
    b.view.unmount()
    await act(async () => {
      release({ kind: 'bytes', path: `${ROOT}/logo.png`, data: PNG_BASE64, mediaType: 'image/png' })
    })
  })

  it('ignores a save that settles after unmount', async () => {
    let release!: (result: FileWriteResult) => void
    const b = mount({
      write: () => new Promise<FileWriteResult>((resolve) => { release = resolve }),
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README.md/ })).toBeTruthy() })
    fireEvent.change(screen.getByRole('textbox', { name: /README.md/ }), { target: { value: 'x\n' } })
    saveShortcut()
    b.view.unmount()
    await act(async () => { release({ path: `${ROOT}/README.md` }) })
  })

  it('ignores a save that rejects after unmount', async () => {
    let fail!: (error: unknown) => void
    const b = mount({
      write: () => new Promise<FileWriteResult>((_resolve, reject) => { fail = reject }),
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README.md/ })).toBeTruthy() })
    fireEvent.change(screen.getByRole('textbox', { name: /README.md/ }), { target: { value: 'x\n' } })
    saveShortcut()
    b.view.unmount()
    await act(async () => { fail(new Error('gone')) })
  })

  it('loading-open-save: open and save show in-pane status without hiding the tree', async () => {
    let releaseRead!: (result: FileReadResult) => void
    let releaseWrite!: (result: FileWriteResult) => void
    const b = mount({
      read: () => new Promise<FileReadResult>((resolve) => { releaseRead = resolve }),
      write: () => new Promise<FileWriteResult>((resolve) => { releaseWrite = resolve }),
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByText('加载中…')).toBeTruthy() })
    expect(screen.getByPlaceholderText('按文件名过滤')).toBeTruthy()
    expect(screen.queryByText('未打开文件')).toBeNull()
    await act(async () => {
      releaseRead({ kind: 'text', path: `${ROOT}/README.md`, text: 'loaded\n' })
    })
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md.*Markdown/ })).toBeTruthy() })
    fireEvent.change(screen.getByRole('textbox', { name: /README\.md.*Markdown/ }), { target: { value: 'dirty\n' } })
    saveShortcut()
    await waitFor(() => { expect(screen.getByText('保存中…')).toBeTruthy() })
    expect(screen.getByPlaceholderText('按文件名过滤')).toBeTruthy()
    await act(async () => { releaseWrite({ path: `${ROOT}/README.md` }) })
    await waitFor(() => { expect(screen.queryByText('保存中…')).toBeNull() })
    expect(b.writeFile).toHaveBeenCalled()
  })

  it('error-open-save: failed open and save show copy plus Retry', async () => {
    let openFail = true
    let writeFail = true
    const b = mount({
      read: async (_id, path, kind) => {
        if (openFail) throw new Error('denied')
        return defaultReadFile(_id, path, kind)
      },
      write: async (_id, path, _text) => {
        if (writeFail) throw new Error('denied')
        return { path }
      },
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByText('无法打开此文件')).toBeTruthy() })
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
    openFail = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md.*Markdown/ })).toBeTruthy() })
    fireEvent.change(screen.getByRole('textbox', { name: /README\.md.*Markdown/ }), { target: { value: 'x\n' } })
    saveShortcut()
    await waitFor(() => { expect(screen.getByText('无法保存此文件')).toBeTruthy() })
    writeFail = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => { expect(screen.queryByText('无法保存此文件')).toBeNull() })
    expect(b.writeFile).toHaveBeenCalled()
    expect(screen.queryByLabelText('未保存')).toBeNull()
  })

  it('theme-follow: the buffer accessible name tracks body[data-ds-dark-theme]', async () => {
    document.body.removeAttribute('data-ds-dark-theme')
    mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /浅色/ })).toBeTruthy() })
    await act(async () => { document.body.setAttribute('data-ds-dark-theme', '') })
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /深色/ })).toBeTruthy() })
    await act(async () => { document.body.removeAttribute('data-ds-dark-theme') })
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /浅色/ })).toBeTruthy() })
  })

  it('ignores an open that settles after unmount', async () => {
    let release!: (result: FileReadResult) => void
    const b = mount({
      read: () => new Promise<FileReadResult>((resolve) => { release = resolve }),
    })
    await clickFile('README.md')
    b.view.unmount()
    await act(async () => {
      release({ kind: 'text', path: `${ROOT}/README.md`, text: 'late\n' })
    })
  })

  it('ignores an open that rejects after unmount', async () => {
    let fail!: (error: unknown) => void
    const b = mount({
      read: () => new Promise<FileReadResult>((_resolve, reject) => { fail = reject }),
    })
    await clickFile('README.md')
    b.view.unmount()
    await act(async () => { fail(new Error('gone')) })
  })

  it('shows open error when a text read returns bytes', async () => {
    mount({
      read: async (_id, path) => ({ kind: 'bytes', path, data: PNG_BASE64, mediaType: 'image/png' }),
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByText('无法打开此文件')).toBeTruthy() })
  })

  it('shows open error when a preview read returns text', async () => {
    mount({
      read: async (_id, path) => ({ kind: 'text', path, text: 'not an image' }),
    })
    await clickFile('logo.png')
    await waitFor(() => { expect(screen.getByText('无法打开此文件')).toBeTruthy() })
  })
})

describe('EditorSurface file operations', () => {
  async function selectRow(name: string): Promise<void> {
    const tree = await waitFor(() => screen.getByRole('tree', { name: 'alpha' }))
    fireEvent.click(within(tree).getByText(name).closest('[role="treeitem"]')!)
  }

  function toolbarButton(label: string): HTMLButtonElement {
    const bar = document.querySelector('[data-file-tree-toolbar="true"]')
    expect(bar).not.toBeNull()
    return within(bar as HTMLElement).getByRole('button', { name: label })
  }

  it('toolbar-default: shows enabled new-file and new-folder toolbar controls', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(toolbarButton('新建文件').getAttribute('aria-disabled')).toBeNull()
    expect(toolbarButton('新建文件夹').getAttribute('aria-disabled')).toBeNull()
  })

  it('toolbar-disabled: keeps rename and delete disabled until a tree row is selected', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(toolbarButton('重命名').getAttribute('aria-disabled')).toBe('true')
    expect(toolbarButton('删除').getAttribute('aria-disabled')).toBe('true')
    await selectRow('README.md')
    expect(toolbarButton('重命名').getAttribute('aria-disabled')).toBeNull()
    expect(toolbarButton('删除').getAttribute('aria-disabled')).toBeNull()
  })

  it('creates a folder in the bound Workspace and reloads the parent layer', async () => {
    let rootCalls = 0
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) {
        rootCalls += 1
        return rootCalls === 1
          ? listingFor(path)
          : {
            path,
            entries: [...DEFAULT_ROOT, entry('notes', true)],
            truncated: false,
          }
      }
      return listingFor(path)
    })
    const b = mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(toolbarButton('新建文件夹'))
    const folderDialog = await waitFor(() => screen.getByRole('dialog', { name: '新建文件夹' }))
    fireEvent.change(within(folderDialog).getByLabelText('名称'), { target: { value: 'notes' } })
    fireEvent.click(within(folderDialog).getByRole('button', { name: '创建' }))
    await waitFor(() => { expect(screen.getByText('notes')).toBeTruthy() })
    expect(b.createWorkspaceDirectory).toHaveBeenCalledWith(WID, ROOT, 'notes')
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('creates a file, opens it for editing, and reloads the parent layer', async () => {
    let rootCalls = 0
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) {
        rootCalls += 1
        return rootCalls === 1
          ? listingFor(path)
          : {
            path,
            entries: [...DEFAULT_ROOT, entry('draft.ts', false)],
            truncated: false,
          }
      }
      return listingFor(path)
    })
    const readFile = vi.fn(async (_id: WorkspaceId, path: string, kind: FileReadKind) => {
      if (path.endsWith('draft.ts') && kind === 'text') {
        return { kind: 'text' as const, path, text: '' }
      }
      return defaultReadFile(_id, path, kind)
    })
    const b = mount({ list: listWorkspaceEntries, read: readFile })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(toolbarButton('新建文件'))
    const fileDialog = await waitFor(() => screen.getByRole('dialog', { name: '新建文件' }))
    fireEvent.change(within(fileDialog).getByLabelText('名称'), { target: { value: 'draft.ts' } })
    fireEvent.click(within(fileDialog).getByRole('button', { name: '创建' }))
    await waitFor(() => { expect(screen.getByRole('tab', { name: /draft\.ts/ })).toBeTruthy() })
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/draft.ts`, '')
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('opens the new-file dialog from the empty editor CTA', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('未打开文件')).toBeTruthy() })
    const emptyCard = screen.getByText('从左侧文件树选择文件，或新建文件').parentElement!
    fireEvent.click(within(emptyCard).getByRole('button', { name: '新建文件' }))
    await waitFor(() => { expect(screen.getByRole('dialog', { name: '新建文件' })).toBeTruthy() })
  })

  it('renames the selected path and updates an open tab', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => listingFor(path))
    const b = mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(screen.getByRole('tree', { name: 'alpha' })).getByText('README.md').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    fireEvent.click(toolbarButton('重命名'))
    const renameDialog = await waitFor(() => screen.getByRole('dialog', { name: '重命名' }))
    fireEvent.change(within(renameDialog).getByLabelText('名称'), { target: { value: 'GUIDE.md' } })
    fireEvent.click(within(renameDialog).getByRole('button', { name: '重命名' }))
    await waitFor(() => { expect(screen.getByText('GUIDE.md')).toBeTruthy() })
    expect(b.renamePath).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'GUIDE.md')
    expect(screen.getByRole('tab', { name: /GUIDE\.md/ })).toBeTruthy()
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('rename-conflict: shows validation copy and does not call Host rename', async () => {
    const renamePath = vi.fn(async () => {
      throw new DirectoryBrowseError({
        code: 'directory-exists',
        message: 'exists',
        details: { path: `${ROOT}/README.md` },
      })
    })
    const b = mount({ renamePath })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    await selectRow('untracked.ts')
    fireEvent.click(toolbarButton('重命名'))
    const renameDialog = await waitFor(() => screen.getByRole('dialog', { name: '重命名' }))
    fireEvent.change(within(renameDialog).getByLabelText('名称'), { target: { value: 'README.md' } })
    fireEvent.click(within(renameDialog).getByRole('button', { name: '重命名' }))
    await waitFor(() => { expect(screen.getByText('已存在同名路径')).toBeTruthy() })
    expect(b.renamePath).not.toHaveBeenCalled()
  })

  it('delete-confirm: requires explicit confirmation before deleting', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => listingFor(path))
    const b = mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('untracked.ts')).toBeTruthy() })
    await selectRow('untracked.ts')
    fireEvent.click(toolbarButton('删除'))
    const deleteDialog = await waitFor(() => screen.getByRole('dialog', { name: '删除' }))
    expect(b.deletePath).not.toHaveBeenCalled()
    fireEvent.click(within(deleteDialog).getByRole('button', { name: '取消' }))
    expect(b.deletePath).not.toHaveBeenCalled()
    fireEvent.click(toolbarButton('删除'))
    const confirmDialog = await waitFor(() => screen.getByRole('dialog', { name: '删除' }))
    fireEvent.click(within(confirmDialog).getByRole('button', { name: '删除' }))
    await waitFor(() => { expect(screen.queryByText('untracked.ts')).toBeNull() })
    expect(b.deletePath).toHaveBeenCalledWith(WID, `${ROOT}/untracked.ts`)
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('delete-submitting: disables the confirm button while deletion is in flight', async () => {
    let release!: () => void
    const deletePath = vi.fn(() => new Promise<{ path: string }>((resolve) => {
      release = () => { resolve({ path: `${ROOT}/untracked.ts` }) }
    }))
    mount({ deletePath })
    await waitFor(() => { expect(screen.getByText('untracked.ts')).toBeTruthy() })
    await selectRow('untracked.ts')
    fireEvent.click(toolbarButton('删除'))
    const deleteDialog = await waitFor(() => screen.getByRole('dialog', { name: '删除' }))
    const confirm = within(deleteDialog).getByRole<HTMLButtonElement>('button', { name: '删除' })
    fireEvent.click(confirm)
    await waitFor(() => { expect(confirm.disabled).toBe(true) })
    await act(async () => { release() })
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '删除' })).toBeNull() })
  })

  it('error-op: surfaces delete failures inside the confirmation dialog', async () => {
    const deletePath = vi.fn(async () => {
      throw new Error('denied')
    })
    mount({ deletePath })
    await waitFor(() => { expect(screen.getByText('untracked.ts')).toBeTruthy() })
    await selectRow('untracked.ts')
    fireEvent.click(toolbarButton('删除'))
    const deleteDialog = await waitFor(() => screen.getByRole('dialog', { name: '删除' }))
    fireEvent.click(within(deleteDialog).getByRole('button', { name: '删除' }))
    await waitFor(() => { expect(screen.getByText('无法删除此路径')).toBeTruthy() })
    expect(within(screen.getByRole('tree', { name: 'alpha' })).getByText('untracked.ts')).toBeTruthy()
  })
})

describe('EditorSurface external change', () => {
  const README = `${ROOT}/README.md`

  function createWatchHarness() {
    const handlers = new Map<string, () => void>()
    const watchPath = vi.fn((
      _id: WorkspaceId,
      path: string,
      onChanged: () => void,
      signal?: AbortSignal,
    ) => {
      handlers.set(path, onChanged)
      signal?.addEventListener('abort', () => { handlers.delete(path) })
    })
    return {
      watchPath,
      trigger(path: string): void {
        handlers.get(path)?.()
      },
      isWatching(path: string): boolean {
        return handlers.has(path)
      },
    }
  }

  async function clickFile(name: string): Promise<void> {
    const tree = await waitFor(() => screen.getByRole('tree', { name: 'alpha' }))
    fireEvent.click(within(tree).getByText(name).closest('[role="treeitem"]')!)
  }

  it('external-change: a fake watch event shows the external-change dialog', async () => {
    const watch = createWatchHarness()
    const readCounts = new Map<string, number>()
    mount({
      watchPath: watch.watchPath,
      read: async (_id, path, kind) => {
        if (kind !== 'text') return defaultReadFile(_id, path, kind)
        const count = (readCounts.get(path) ?? 0) + 1
        readCounts.set(path, count)
        return {
          kind: 'text' as const,
          path,
          text: count === 1 ? 'initial\n' : 'external\n',
        }
      },
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md/ })).toBeTruthy() })
    expect(watch.watchPath).toHaveBeenCalledWith(WID, README, expect.any(Function), expect.any(AbortSignal))
    await act(async () => { watch.trigger(README) })
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '文件已在磁盘上更改' }))
    expect(within(dialog).getByText('README.md')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '重新加载' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '保留本地编辑' })).toBeTruthy()
  })

  it('reload-discard: choosing reload replaces the edit buffer with disk content', async () => {
    const watch = createWatchHarness()
    const readCounts = new Map<string, number>()
    mount({
      watchPath: watch.watchPath,
      read: async (_id, path, kind) => {
        if (kind !== 'text') return defaultReadFile(_id, path, kind)
        const count = (readCounts.get(path) ?? 0) + 1
        readCounts.set(path, count)
        return {
          kind: 'text' as const,
          path,
          text: count === 1 ? 'initial\n' : 'external\n',
        }
      },
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md/ })).toBeTruthy() })
    fireEvent.change(
      screen.getByRole('textbox', { name: /README\.md/ }),
      { target: { value: 'local edits\n' } },
    )
    await act(async () => { watch.trigger(README) })
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '文件已在磁盘上更改' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '重新加载' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '文件已在磁盘上更改' })).toBeNull() })
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md/ }).value).toBe('external\n')
    expect(screen.queryByLabelText('未保存')).toBeNull()
  })

  it('keep-local: choosing keep local leaves the edit buffer unchanged', async () => {
    const watch = createWatchHarness()
    const readCounts = new Map<string, number>()
    mount({
      watchPath: watch.watchPath,
      read: async (_id, path, kind) => {
        if (kind !== 'text') return defaultReadFile(_id, path, kind)
        const count = (readCounts.get(path) ?? 0) + 1
        readCounts.set(path, count)
        return {
          kind: 'text' as const,
          path,
          text: count === 1 ? 'initial\n' : 'external\n',
        }
      },
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md/ })).toBeTruthy() })
    fireEvent.change(
      screen.getByRole('textbox', { name: /README\.md/ }),
      { target: { value: 'local edits\n' } },
    )
    await act(async () => { watch.trigger(README) })
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '文件已在磁盘上更改' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '保留本地编辑' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '文件已在磁盘上更改' })).toBeNull() })
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md/ }).value).toBe('local edits\n')
    expect(screen.getByLabelText('未保存')).toBeTruthy()
  })

  it('watch-released: closing a tab stops delivering watch events for that path', async () => {
    const watch = createWatchHarness()
    const b = mount({ watchPath: watch.watchPath })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    expect(watch.isWatching(README)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    await waitFor(() => { expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull() })
    expect(watch.isWatching(README)).toBe(false)
    await act(async () => { watch.trigger(README) })
    expect(screen.queryByRole('dialog', { name: '文件已在磁盘上更改' })).toBeNull()
    expect(b.watchPath.mock.calls.every(call => call[1] !== ROOT)).toBe(true)
  })
})

describe('EditorSurface dirty guard', () => {
  const README = `${ROOT}/README.md`

  async function clickFile(name: string): Promise<void> {
    const tree = await waitFor(() => screen.getByRole('tree', { name: 'alpha' }))
    fireEvent.click(within(tree).getByText(name).closest('[role="treeitem"]')!)
  }

  async function dirtyReadme(): Promise<void> {
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('textbox', { name: /README\.md/ })).toBeTruthy() })
    fireEvent.change(
      screen.getByRole('textbox', { name: /README\.md/ }),
      { target: { value: 'local edits\n' } },
    )
    expect(screen.getByLabelText('未保存')).toBeTruthy()
  }

  it('save-fail-stay: a failed save keeps the guard open', async () => {
    const writeFile = vi.fn(async () => { throw new Error('denied') })
    mount({ write: writeFile })
    await dirtyReadme()
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '未保存的更改' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => { expect(screen.getByText('无法保存此文件')).toBeTruthy() })
    expect(screen.getByRole('dialog', { name: '未保存的更改' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy()
  })

  it('cross-workspace switch: preserves each Workspace editor partition independently', async () => {
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
    const b = mount({ items: [workspace(), other], list: listWorkspaceEntries })
    await dirtyReadme()
    const nextWorkspaces = createSnapshotStore(workspacesState([workspace(), other]))
    b.sessionsStore.update((s) => { s.current = 's2' as SessionId })
    b.view.rerender(<EditorSurface {...b.props} useWorkspaces={hookOf(nextWorkspaces)} />)
    await waitFor(() => { expect(screen.getByText('only-beta.ts')).toBeTruthy() })
    expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull()
    expect(screen.getByText('未打开文件')).toBeTruthy()
    b.sessionsStore.update((s) => { s.current = SID })
    b.view.rerender(<EditorSurface {...b.props} useWorkspaces={hookOf(nextWorkspaces)} />)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    expect(screen.getByLabelText('未保存')).toBeTruthy()
  })

  it('close-dirty-tab: closing one dirty tab uses the same three buttons', async () => {
    mount()
    await dirtyReadme()
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '未保存的更改' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '未保存的更改' })).toBeNull() })
    expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    const again = await waitFor(() => screen.getByRole('dialog', { name: '未保存的更改' }))
    fireEvent.click(within(again).getByRole('button', { name: '丢弃' }))
    await waitFor(() => { expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull() })
    expect(screen.getByText('未打开文件')).toBeTruthy()
  })

  it('does not show a guard dialog owned by another Workspace', async () => {
    const other = workspace({
      workspaceId: 'ws2' as WorkspaceId,
      path: '/w/beta',
      title: 'beta',
      sessionIds: ['s2' as SessionId],
    })
    const b = mount({ items: [workspace(), other] })
    await dirtyReadme()
    act(() => { editorDirtyGuard.requestCloseTab(WID, README) })
    const nextWorkspaces = createSnapshotStore(workspacesState([workspace(), other]))
    b.sessionsStore.update((s) => { s.current = 's2' as SessionId })
    b.view.rerender(<EditorSurface {...b.props} useWorkspaces={hookOf(nextWorkspaces)} />)
    expect(screen.queryByRole('dialog', { name: '未保存的更改' })).toBeNull()
  })

  it('close-dirty-tab-save: saving from the guard closes the tab', async () => {
    mount()
    await dirtyReadme()
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '未保存的更改' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => { expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull() })
  })
})
