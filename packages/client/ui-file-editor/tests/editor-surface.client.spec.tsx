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
import { DIRECTORY_LISTING_TIMEOUT_MS } from '../src/client/host-io-timeout.ts'

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
  entry('.DS_Store', false),
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
  if (path.endsWith('.md')) {
    return Promise.resolve({ kind: 'text', path, text: `# ${path.split('/').pop()}\n\nPreview **body**\n` })
  }
  return Promise.resolve({ kind: 'text', path, text: `contents of ${path}\n` })
}

async function expectMarkdownSourceOpen(name = 'README.md'): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: 'Markdown' }).getAttribute('aria-selected')).toBe('true')
  })
  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: new RegExp(name) })).toBeTruthy()
  })
}

async function switchMarkdownToSource(): Promise<void> {
  await expectMarkdownSourceOpen()
}

async function markdownEditor(name = 'README.md'): Promise<HTMLTextAreaElement> {
  await waitFor(() => { expect(screen.getByRole('tab', { name: new RegExp(name) })).toBeTruthy() })
  await switchMarkdownToSource()
  return waitFor(() => screen.getByRole<HTMLTextAreaElement>('textbox', { name: new RegExp(name) }))
}

const SRC_CHILDREN: WorkspaceEntry[] = [
  { name: 'app.ts', path: `${ROOT}/src/app.ts`, isDirectory: false, hidden: false },
]

const GIT = `${ROOT}/.git`
const GIT_HOOKS = `${GIT}/hooks`
const GIT_CURSOR = `${GIT}/cursor`
const GIT_CREPE = `${GIT_CURSOR}/crepe`
const GIT_HASH = `${GIT_CREPE}/1099fc`
const DEEP_FILE = `${GIT_HASH}/postings.bin`

const GIT_CHILDREN: WorkspaceEntry[] = [
  { name: 'hooks', path: GIT_HOOKS, isDirectory: true, hidden: true },
  { name: 'index', path: `${GIT}/index`, isDirectory: false, hidden: true },
  { name: 'cursor', path: GIT_CURSOR, isDirectory: true, hidden: true },
  { name: 'objects', path: `${GIT}/objects`, isDirectory: true, hidden: true },
]

const CREPE_CHILDREN: WorkspaceEntry[] = [
  { name: '1099fc', path: GIT_HASH, isDirectory: true, hidden: true },
]

const HASH_CHILDREN: WorkspaceEntry[] = [
  { name: 'postings.bin', path: DEEP_FILE, isDirectory: false, hidden: true },
]

function listingFor(path: string): WorkspaceEntriesListing {
  if (path === ROOT) return { path, entries: DEFAULT_ROOT, truncated: false }
  if (path === `${ROOT}/src`) return { path, entries: SRC_CHILDREN, truncated: false }
  if (path === GIT) return { path, entries: GIT_CHILDREN, truncated: false }
  if (path === GIT_CURSOR) {
    return {
      path,
      entries: [{ name: 'crepe', path: GIT_CREPE, isDirectory: true, hidden: true }],
      truncated: false,
    }
  }
  if (path === GIT_CREPE) return { path, entries: CREPE_CHILDREN, truncated: false }
  if (path === GIT_HASH) return { path, entries: HASH_CHILDREN, truncated: false }
  if (path === `${ROOT}/node_modules`) {
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
  setDirtyPaths?: EditorSurfaceProps['setDirtyPaths']
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
  const lspSyncDocument = vi.fn(async () => ({ diagnostics: [] as const }))
  const lspCloseDocument = vi.fn(async () => ({ closed: true as const }))
  const lspHoverDocument = vi.fn(async () => ({ hover: null }))
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
    lspSyncDocument,
    lspCloseDocument,
    lspHoverDocument,
    dirtyGuard: editorDirtyGuard,
    setDirtyPaths: over.setDirtyPaths ?? (() => {}),
    diskPathsChangedEpoch: 0,
    diskPathsChanged: [],
    diskPathsChangedReload: true,
  } as EditorSurfaceProps
  const view = render(<EditorSurface {...props} />)
  return {
    view, props, instance, sessionsStore, workspacesStore, listWorkspaceEntries, gitStatus, readFile, writeFile,
    deletePath, renamePath, createWorkspaceDirectory, watchPath,
  }
}

describe('EditorSurface file tree', () => {
  async function clickFile(name: string): Promise<void> {
    const tree = await waitFor(() => screen.getByRole('tree', { name: 'alpha' }))
    fireEvent.click(within(tree).getByText(name).closest('[role="treeitem"]')!)
  }

  it('default: binds the Session Workspace, shows hidden paths, type icons, and Git letters', async () => {
    const b = mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.getByText('.git')).toBeTruthy()
    expect(screen.getByText('.gitignore')).toBeTruthy()
    expect(screen.queryByText('.DS_Store')).toBeNull()
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

  it('shows Git U on a nested untracked file and its ancestor folder', async () => {
    const nestedDir = `${ROOT}/hahah`
    const nestedFile = `${nestedDir}/test.md`
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) {
        return {
          path,
          entries: [...DEFAULT_ROOT, { name: 'hahah', path: nestedDir, isDirectory: true, hidden: false }],
          truncated: false,
        }
      }
      if (path === nestedDir) {
        return {
          path,
          entries: [{ name: 'test.md', path: nestedFile, isDirectory: false, hidden: false }],
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const gitStatus = vi.fn(async () => ({
      entries: [{ path: nestedFile, letter: 'U' }],
    }))
    mount({ list: listWorkspaceEntries, git: gitStatus })
    await waitFor(() => { expect(screen.getByText('hahah')).toBeTruthy() })
    const folderRow = screen.getByText('hahah').closest('[role="treeitem"]')
    expect(folderRow).toBeInstanceOf(HTMLElement)
    expect(within(folderRow as HTMLElement).getByLabelText('Git U').textContent).toBe('U')
    fireEvent.click(folderRow as HTMLElement)
    await waitFor(() => { expect(screen.getByText('test.md')).toBeTruthy() })
    const fileRow = screen.getByText('test.md').closest('[role="treeitem"]')
    expect(fileRow).toBeInstanceOf(HTMLElement)
    expect(within(fileRow as HTMLElement).getByLabelText('Git U').textContent).toBe('U')
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

  it('empty-workspace: shows the empty-workspace copy without a tree CTA', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => ({
      path, entries: [] as WorkspaceEntry[], truncated: false,
    }))
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('该工作区暂无文件')).toBeTruthy() })
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

  it('open-file: does not refetch a cached folder or leave its spinner running', async () => {
    let srcCalls = 0
    let releaseSrc!: (listing: WorkspaceEntriesListing) => void
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string) => {
      if (path === `${ROOT}/src`) {
        srcCalls += 1
        if (srcCalls === 1) {
          return new Promise<WorkspaceEntriesListing>((resolve) => { releaseSrc = resolve })
        }
        return new Promise<WorkspaceEntriesListing>(() => {
          // A redundant refetch would hang here without the cache short-circuit.
        })
      }
      return Promise.resolve(listingFor(path))
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy() })
    await act(async () => { releaseSrc(listingFor(`${ROOT}/src`)) })
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()

    const tree = screen.getByRole('tree', { name: 'alpha' })
    fireEvent.click(within(tree).getByText('app.ts').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /app\.ts/ })).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === `${ROOT}/src`)).toHaveLength(1)
  })

  it('reveal-chain: deep open clears every row spinner and skips sibling folders', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      await new Promise<void>((resolve) => { setTimeout(resolve, 5) })
      return listingFor(path)
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('.git')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 .git' }))
    await waitFor(() => { expect(screen.getByText('cursor')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 cursor' }))
    await waitFor(() => { expect(screen.getByText('crepe')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 crepe' }))
    await waitFor(() => { expect(screen.getByText('1099fc')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 1099fc' }))
    await waitFor(() => { expect(screen.getByText('postings.bin')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()

    const tree = screen.getByRole('tree', { name: 'alpha' })
    fireEvent.click(within(tree).getByText('postings.bin').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /postings\.bin/ })).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === GIT_HOOKS)).toHaveLength(0)
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === `${GIT}/objects`)).toHaveLength(0)
  })

  it('reveal-chain: refocusing a deep tab re-expands without stuck spinners', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('.git')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 .git' }))
    await waitFor(() => { expect(screen.getByText('cursor')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 cursor' }))
    await waitFor(() => { expect(screen.getByText('crepe')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 crepe' }))
    await waitFor(() => { expect(screen.getByText('1099fc')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 1099fc' }))
    await waitFor(() => { expect(screen.getByText('postings.bin')).toBeTruthy() })

    const tree = screen.getByRole('tree', { name: 'alpha' })
    fireEvent.click(within(tree).getByText('postings.bin').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /postings\.bin/ })).toBeTruthy() })

    fireEvent.click(screen.getByRole('button', { name: '折叠 .git' }))
    expect(within(tree).queryByText('postings.bin')).toBeNull()
    fireEvent.click(within(tree).getByText('README.md').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: /postings\.bin/ }))
    await waitFor(() => { expect(within(tree).getByText('postings.bin')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    const hooksRow = within(tree).getByText('hooks').closest('[role="treeitem"]') as HTMLElement
    expect(within(hooksRow).queryByRole('status', { name: '加载中' })).toBeNull()
  })

  it('collapse-expand: aborts an in-flight listing and does not leave a stale spinner', async () => {
    let srcCalls = 0
    let release!: (listing: WorkspaceEntriesListing) => void
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string) => {
      if (path === `${ROOT}/src`) {
        srcCalls += 1
        if (srcCalls === 1) {
          return new Promise<WorkspaceEntriesListing>((resolve) => { release = resolve })
        }
        return Promise.resolve(listingFor(path))
      }
      return Promise.resolve(listingFor(path))
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '折叠 src' }))
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    await act(async () => { release(listingFor(`${ROOT}/src`)) })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === `${ROOT}/src`)).toHaveLength(2)
  })

  it('loading-expand: clears the folder spinner after listing data lands', async () => {
    let srcCalls = 0
    let release!: (listing: WorkspaceEntriesListing) => void
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string) => {
      if (path === `${ROOT}/src`) {
        srcCalls += 1
        if (srcCalls === 1) {
          return new Promise<WorkspaceEntriesListing>((resolve) => { release = resolve })
        }
        return Promise.resolve(listingFor(path))
      }
      return Promise.resolve(listingFor(path))
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '折叠 src' }))
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy() })
    await act(async () => { release(listingFor(`${ROOT}/src`)) })
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
  })

  it('list-failure: keeps a failed folder expanded and shows a retry affordance', async () => {
    let calls = 0
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === `${ROOT}/src`) {
        calls += 1
        if (calls === 1) throw new Error('denied')
        return listingFor(path)
      }
      return listingFor(path)
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByLabelText('无法加载此文件夹')).toBeTruthy() })
    expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '折叠 src' }))
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === `${ROOT}/src`)).toHaveLength(2)
  })

  it('list-timeout: marks the folder failed instead of leaving a spinner', async () => {
    const listWorkspaceEntries = vi.fn((_id: WorkspaceId, path: string) => {
      if (path === `${ROOT}/src`) return new Promise<WorkspaceEntriesListing>(() => {})
      return Promise.resolve(listingFor(path))
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
      expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy()
      await act(async () => { await vi.advanceTimersByTimeAsync(DIRECTORY_LISTING_TIMEOUT_MS) })
      expect(screen.getByLabelText('无法加载此文件夹')).toBeTruthy()
      expect(screen.queryByRole('status', { name: '加载中' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
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
    await waitFor(() => { expect(screen.getByText('该工作区暂无文件')).toBeTruthy() })
    expect(screen.queryByText('README.md')).toBeNull()
  })

  it('does not list when the Session has no bound Workspace', async () => {
    const listWorkspaceEntries = vi.fn(async () => listingFor(ROOT))
    mount({ items: [], list: listWorkspaceEntries })
    expect(screen.getByPlaceholderText('按文件名过滤')).toBeTruthy()
    expect(screen.getByText('该工作区暂无文件')).toBeTruthy()
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

  it('keeps a failed folder expanded and marks the row when listing rejects', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) return listingFor(path)
      throw new Error('unreadable')
    })
    mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 src' }))
    await waitFor(() => { expect(screen.getByLabelText('无法加载此文件夹')).toBeTruthy() })
    expect(screen.getByRole('button', { name: '折叠 src' })).toBeTruthy()
    expect(screen.queryByText('app.ts')).toBeNull()
  })

  it('selects a row on click', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const row = screen.getByText('README.md').closest('[role="treeitem"]')
    fireEvent.click(row!)
    expect(row!.getAttribute('aria-selected')).toBe('true')
  })

  it('tree-focus: clicking an already-open file focuses its editor tab and body', async () => {
    mount()
    await clickFile('README.md')
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /README\.md/ }).getAttribute('aria-selected')).toBe('true')
    })
    await clickFile('untracked.ts')
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /untracked\.ts/ }).getAttribute('aria-selected')).toBe('true')
      expect(screen.getByRole('textbox', { name: /untracked\.ts.*TypeScript/ })).toBeTruthy()
    })
    await clickFile('README.md')
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /README\.md/ }).getAttribute('aria-selected')).toBe('true')
    })
    await switchMarkdownToSource()
    expect(screen.getByRole('textbox', { name: /README\.md/ })).toBeTruthy()
  })

  it('tab-reveal: scrolls the active editor tab into view when activePath changes', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    })
    mount()
    await clickFile('README.md')
    await waitFor(() => { expect(scrollIntoView).toHaveBeenCalled() })
    scrollIntoView.mockClear()
    await clickFile('untracked.ts')
    await waitFor(() => { expect(scrollIntoView).toHaveBeenCalled() })
  })

  it('reveals and selects the active editor tab path in the tree', async () => {
    const b = mount()
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    await act(async () => {
      b.instance.actions.openTab(WID, {
        kind: 'text',
        path: `${ROOT}/src/app.ts`,
        name: 'app.ts',
        language: 'typescript',
        buffer: 'export {}\n',
        saved: 'export {}\n',
        diskReloadTicket: 0,
      })
    })
    await waitFor(() => {
      const tree = screen.getByRole('tree', { name: 'alpha' })
      const row = within(tree).getByText('app.ts').closest('[role="treeitem"]')
      expect(row?.getAttribute('aria-selected')).toBe('true')
    })
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
    await expectMarkdownSourceOpen()
    const box = await markdownEditor()
    expect(box.value).toBe('# README.md\n\nPreview **body**\n')
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(b.readFile).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'text', expect.any(AbortSignal))
  })

  it('default-source: opening a Markdown file selects source mode', async () => {
    mount()
    await clickFile('README.md')
    await expectMarkdownSourceOpen()
    expect(screen.getByRole('tab', { name: '预览' }).getAttribute('aria-selected')).toBe('false')
  })

  it('markdown-preview: toggles between preview and Markdown source', async () => {
    mount()
    await clickFile('README.md')
    await expectMarkdownSourceOpen()
    fireEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(screen.getByRole('textbox', { name: /README\.md.*预览/ })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /README\.md.*Markdown/ })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'README.md' })).toBeTruthy()
  })

  it('markdown-source-save: saving keeps Markdown source mode and the editor mounted', async () => {
    let releaseWrite!: (result: FileWriteResult) => void
    const b = mount({
      write: () => new Promise<FileWriteResult>((resolve) => { releaseWrite = resolve }),
    })
    await clickFile('README.md')
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: '# edited\n\nsaved body\n' } })
    saveShortcut()
    expect(screen.queryByText('保存中…')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Markdown' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md/ }).value)
      .toBe('# edited\n\nsaved body\n')
    await act(async () => { releaseWrite({ path: `${ROOT}/README.md` }) })
    await waitFor(() => { expect(screen.queryByLabelText('未保存')).toBeNull() })
    expect(screen.getByRole('tab', { name: 'Markdown' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('heading', { level: 1, name: 'edited' })).toBeNull()
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md/ }).value)
      .toBe('# edited\n\nsaved body\n')
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, '# edited\n\nsaved body\n', expect.any(AbortSignal))
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
    expect(screen.getByRole('button', { name: '放大' })).toBeTruthy()
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
    expect(screen.getByText('从左侧文件树选择文件')).toBeTruthy()
    expect(screen.queryByRole('tablist', { name: '编辑器标签页' })).toBeNull()
    fireEvent.keyDown(window, { key: 's', metaKey: true })
  })

  it('dirty-unsaved: editing shows a dirty mark; ⌘S writes and clears it', async () => {
    const b = mount()
    await clickFile('README.md')
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'edited readme\n' } })
    await waitFor(() => { expect(screen.getByLabelText('未保存')).toBeTruthy() })
    saveShortcut()
    await waitFor(() => { expect(screen.queryByLabelText('未保存')).toBeNull() })
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'edited readme\n', expect.any(AbortSignal))
    const again = await markdownEditor()
    fireEvent.change(again, { target: { value: 'again\n' } })
    await waitFor(() => { expect(screen.getByLabelText('未保存')).toBeTruthy() })
    saveShortcut()
    await waitFor(() => { expect(screen.queryByLabelText('未保存')).toBeNull() })
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'again\n', expect.any(AbortSignal))
  })

  it('save-refreshes-git: saving re-fetches Git badges without rebinding the Workspace', async () => {
    const b = mount()
    await waitFor(() => { expect(b.gitStatus).toHaveBeenCalledTimes(1) })
    await clickFile('README.md')
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'edited readme\n' } })
    saveShortcut()
    await waitFor(() => { expect(b.gitStatus.mock.calls.length).toBeGreaterThan(1) })
  })

  it('re-fetches Git badges when the Explorer tab becomes visible again', async () => {
    const b = mount()
    await waitFor(() => { expect(b.gitStatus).toHaveBeenCalledTimes(1) })
    b.view.rerender(<EditorSurface {...b.props} visible={false} />)
    expect(b.gitStatus).toHaveBeenCalledTimes(1)
    b.view.rerender(<EditorSurface {...b.props} visible={true} />)
    await waitFor(() => { expect(b.gitStatus.mock.calls.length).toBeGreaterThan(1) })
  })

  it('save-skips-tree-refresh: saving updates Git badges without re-fetching the parent directory listing', async () => {
    const b = mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const initialRootListings = b.listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length
    await clickFile('README.md')
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'edited readme\n' } })
    saveShortcut()
    await waitFor(() => { expect(b.gitStatus.mock.calls.length).toBeGreaterThan(1) })
    expect(b.listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length)
      .toBe(initialRootListings)
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
    await markdownEditor()
    expect(b.readFile).toHaveBeenCalledTimes(2)
    await clickFile('README.md')
    expect(b.readFile).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    await waitFor(() => { expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull() })
    expect(screen.getByRole('textbox', { name: /untracked\.ts.*TypeScript/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭 untracked.ts' }))
    await waitFor(() => { expect(screen.getByText('未打开文件')).toBeTruthy() })
  })

  it('tab-menu-close-others: the tab context menu closes every tab except the anchor', async () => {
    mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    await clickFile('untracked.ts')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /untracked\.ts/ })).toBeTruthy() })
    await clickFile('gone.ts')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /gone\.ts/ })).toBeTruthy() })
    fireEvent.contextMenu(screen.getByRole('tab', { name: /README\.md/ }))
    fireEvent.click(await waitFor(() => screen.getByRole('menuitem', { name: '关闭其他' })))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy()
      expect(screen.queryByRole('tab', { name: /untracked\.ts/ })).toBeNull()
      expect(screen.queryByRole('tab', { name: /gone\.ts/ })).toBeNull()
    })
  })

  it('tab-menu-close-all: the tab context menu closes every tab', async () => {
    mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    await clickFile('untracked.ts')
    await waitFor(() => { expect(screen.getAllByRole('tab').length).toBe(2) })
    fireEvent.contextMenu(screen.getByRole('tab', { name: /README\.md/ }))
    fireEvent.click(await waitFor(() => screen.getByRole('menuitem', { name: '关闭全部' })))
    await waitFor(() => { expect(screen.queryByRole('tab')).toBeNull() })
    expect(screen.getByText('未打开文件')).toBeTruthy()
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
    const readmeBox = await markdownEditor()
    fireEvent.change(readmeBox, { target: { value: 'x\n' } })
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
    const readmeBox = await markdownEditor()
    fireEvent.change(readmeBox, { target: { value: 'x\n' } })
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
    const readmeBox = await markdownEditor()
    fireEvent.change(readmeBox, { target: { value: 'x\n' } })
    saveShortcut()
    b.view.unmount()
    await act(async () => { fail(new Error('gone')) })
  })

  it('silent-save: save keeps the editor visible without in-pane loading', async () => {
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
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'dirty\n' } })
    saveShortcut()
    expect(screen.queryByText('保存中…')).toBeNull()
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /README\.md/ }).value).toBe('dirty\n')
    expect(screen.getByPlaceholderText('按文件名过滤')).toBeTruthy()
    await act(async () => { releaseWrite({ path: `${ROOT}/README.md` }) })
    await waitFor(() => { expect(screen.queryByLabelText('未保存')).toBeNull() })
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
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'x\n' } })
    saveShortcut()
    await waitFor(() => { expect(screen.getByText('无法保存此文件')).toBeTruthy() })
    writeFail = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => { expect(screen.queryByText('无法保存此文件')).toBeNull() })
    expect(b.writeFile).toHaveBeenCalled()
    expect(screen.queryByLabelText('未保存')).toBeNull()
  })

  it('open-error: a failed background open keeps the focused tab visible', async () => {
    mount({
      read: async (_id, path, kind) => {
        if (path.endsWith('gone.ts')) throw new Error('denied')
        return defaultReadFile(_id, path, kind)
      },
    })
    await clickFile('README.md')
    await expectMarkdownSourceOpen()
    await clickFile('gone.ts')
    await expectMarkdownSourceOpen()
    expect(screen.queryByText('无法打开此文件')).toBeNull()
    expect(screen.queryByRole('tab', { name: /gone\.ts/ })).toBeNull()
  })

  it('open-loading: focusing another tab aborts a pending background open', async () => {
    const b = mount({
      read: (_id, path, kind) => {
        if (path.endsWith('gone.ts')) {
          return new Promise<FileReadResult>(() => {
            // Never resolves until the test switches away.
          })
        }
        return defaultReadFile(_id, path, kind)
      },
    })
    await clickFile('README.md')
    await expectMarkdownSourceOpen()
    await clickFile('gone.ts')
    await expectMarkdownSourceOpen()
    expect(screen.queryByText('加载中…')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /README\.md/ }))
    await expectMarkdownSourceOpen()
    expect(b.readFile.mock.calls.filter(call => call[1]?.endsWith('gone.ts'))).toHaveLength(1)
  })

  it('open-loading: opening another file from the tree replaces the spinner with the new buffer', async () => {
    let releaseGone!: (result: FileReadResult) => void
    mount({
      read: (_id, path, kind) => {
        if (path.endsWith('gone.ts')) {
          return new Promise<FileReadResult>((resolve) => { releaseGone = resolve })
        }
        return defaultReadFile(_id, path, kind)
      },
    })
    await clickFile('gone.ts')
    await waitFor(() => { expect(screen.getByText('加载中…')).toBeTruthy() })
    await clickFile('README.md')
    await expectMarkdownSourceOpen()
    expect(screen.queryByText('加载中…')).toBeNull()
    await act(async () => {
      releaseGone!({ kind: 'text', path: `${ROOT}/gone.ts`, text: 'late\n' })
    })
    await expectMarkdownSourceOpen()
    expect(screen.queryByRole('tab', { name: /gone\.ts/ })).toBeNull()
  })

  it('open-loading: keeps the active tab visible while another file opens', async () => {
    mount({
      read: (_id, path, kind) => {
        if (path.endsWith('gone.ts')) {
          return new Promise<FileReadResult>(() => {})
        }
        return defaultReadFile(_id, path, kind)
      },
    })
    await clickFile('README.md')
    await expectMarkdownSourceOpen()
    await clickFile('gone.ts')
    await expectMarkdownSourceOpen()
    expect(screen.queryByText('加载中…')).toBeNull()
  })

  it('open-error: clicking a directory dismisses the open error overlay', async () => {
    mount({
      read: async (_id, path, kind) => {
        if (path.endsWith('gone.ts')) throw new Error('denied')
        return defaultReadFile(_id, path, kind)
      },
    })
    await clickFile('gone.ts')
    await waitFor(() => { expect(screen.getByText('无法打开此文件')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 .git' }))
    await waitFor(() => { expect(screen.queryByText('无法打开此文件')).toBeNull() })
  })

  it('open-loading: clicking a directory dismisses the open spinner', async () => {
    mount({
      read: (_id, path, kind) => {
        if (path.endsWith('gone.ts')) {
          return new Promise<FileReadResult>(() => {})
        }
        return defaultReadFile(_id, path, kind)
      },
    })
    await clickFile('gone.ts')
    await waitFor(() => { expect(screen.getByText('加载中…')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '展开 .git' }))
    await waitFor(() => { expect(screen.queryByText('加载中…')).toBeNull() })
  })

  it('theme-follow: the buffer accessible name tracks body[data-ds-dark-theme]', async () => {
    document.body.removeAttribute('data-ds-dark-theme')
    mount()
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    await switchMarkdownToSource()
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

  it('shows a dedicated message when Host rejects an oversize file', async () => {
    mount({
      read: async (_id, path) => {
        throw new DirectoryBrowseError({
          code: 'file-too-large',
          message: 'file too large',
          details: { path, size: 6_000_000, limit: 5_242_880 },
        })
      },
    })
    await clickFile('README.md')
    await waitFor(() => { expect(screen.getByText(/文件过大/)).toBeTruthy() })
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

  function openTreeContextMenu(name: string, options: { directory?: boolean } = {}): void {
    const tree = screen.getByRole('tree', { name: 'alpha' })
    const matches = within(tree).getAllByText(name)
    const row = (options.directory
      ? matches
        .map(node => node.closest('[role="treeitem"]'))
        .find(item => item?.hasAttribute('aria-expanded'))
      : matches[0]?.closest('[role="treeitem"]'))!
    fireEvent.contextMenu(row)
  }

  async function chooseTreeMenuItem(label: string): Promise<void> {
    fireEvent.click(await waitFor(() => screen.getByRole('menuitem', { name: label })))
  }

  it('toolbar-default: shows enabled new-file and new-folder toolbar controls', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(toolbarButton('新建文件').getAttribute('aria-disabled')).toBeNull()
    expect(toolbarButton('新建文件夹').getAttribute('aria-disabled')).toBeNull()
  })

  it('toolbar-header: shows the bound Workspace title beside tree actions', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const bar = document.querySelector('[data-file-tree-toolbar="true"]')
    expect(bar).not.toBeNull()
    expect(within(bar as HTMLElement).getByText('alpha')).toBeTruthy()
    expect(toolbarButton('刷新').getAttribute('aria-disabled')).toBeNull()
    expect(within(bar as HTMLElement).queryByRole('button', { name: '重命名' })).toBeNull()
    expect(within(bar as HTMLElement).queryByRole('button', { name: '删除' })).toBeNull()
  })

  it('tree-context-menu: files get rename/delete; folders also get create actions', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    openTreeContextMenu('README.md')
    expect(await waitFor(() => screen.getByRole('menuitem', { name: '重命名' }))).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '删除' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '新建文件' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: '新建子文件夹' })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByRole('menuitem', { name: '重命名' })).toBeNull() })
    openTreeContextMenu('src')
    expect(await waitFor(() => screen.getByRole('menuitem', { name: '新建文件' }))).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '新建子文件夹' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '重命名' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '删除' })).toBeTruthy()
  })

  it('creates a file inside a folder from the tree context menu', async () => {
    let srcCalls = 0
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === `${ROOT}/src`) {
        srcCalls += 1
        return srcCalls === 1
          ? listingFor(path)
          : {
            path,
            entries: [...SRC_CHILDREN, entry('draft.ts', false)],
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
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    openTreeContextMenu('src')
    await chooseTreeMenuItem('新建文件')
    const fileDialog = await waitFor(() => screen.getByRole('dialog', { name: '新建文件' }))
    fireEvent.change(within(fileDialog).getByLabelText('名称'), { target: { value: 'draft.ts' } })
    fireEvent.click(within(fileDialog).getByRole('button', { name: '创建' }))
    await waitFor(() => { expect(screen.getByRole('tab', { name: /draft\.ts/ })).toBeTruthy() })
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/src/draft.ts`, '')
    expect(listWorkspaceEntries).toHaveBeenCalledWith(WID, `${ROOT}/src`, expect.anything())
  })

  it('creates a subfolder inside a folder from the tree context menu', async () => {
    let createdInSrc = false
    const createWorkspaceDirectory = vi.fn(async (_id: WorkspaceId, parent: string, name: string) => {
      if (parent === `${ROOT}/src`) createdInSrc = true
      return { path: `${parent}/${name}` }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === `${ROOT}/src` && createdInSrc) {
        return {
          path,
          entries: [...SRC_CHILDREN, entry('components', true)],
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const b = mount({ list: listWorkspaceEntries, createWorkspaceDirectory })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    openTreeContextMenu('src')
    await chooseTreeMenuItem('新建子文件夹')
    const folderDialog = await waitFor(() => screen.getByRole('dialog', { name: '新建文件夹' }))
    fireEvent.change(within(folderDialog).getByLabelText('名称'), { target: { value: 'components' } })
    fireEvent.click(within(folderDialog).getByRole('button', { name: '创建' }))
    await waitFor(() => { expect(screen.getByText('components')).toBeTruthy() })
    expect(b.createWorkspaceDirectory).toHaveBeenCalledWith(WID, `${ROOT}/src`, 'components')
    expect(listWorkspaceEntries).toHaveBeenCalledWith(WID, `${ROOT}/src`, expect.anything())
  })

  it('creates a folder in the bound Workspace and reloads the parent layer', async () => {
    let created = false
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT && created) {
        return {
          path,
          entries: [...DEFAULT_ROOT, entry('notes', true)],
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const createWorkspaceDirectory = vi.fn(async (_id: WorkspaceId, parent: string, name: string) => {
      created = true
      return { path: `${parent}/${name}` }
    })
    const b = mount({ list: listWorkspaceEntries, createWorkspaceDirectory })
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
    let created = false
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT && created) {
        return {
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
    const writeFile = vi.fn(async (_id: WorkspaceId, path: string, _text: string) => {
      created = true
      return { path }
    })
    const b = mount({ list: listWorkspaceEntries, read: readFile, write: writeFile })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(toolbarButton('新建文件'))
    const fileDialog = await waitFor(() => screen.getByRole('dialog', { name: '新建文件' }))
    fireEvent.change(within(fileDialog).getByLabelText('名称'), { target: { value: 'draft.ts' } })
    fireEvent.click(within(fileDialog).getByRole('button', { name: '创建' }))
    await waitFor(() => { expect(screen.getByRole('tab', { name: /draft\.ts/ })).toBeTruthy() })
    expect(b.writeFile).toHaveBeenCalledWith(WID, `${ROOT}/draft.ts`, '')
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('renames the selected path and updates an open tab', async () => {
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => listingFor(path))
    const b = mount({ list: listWorkspaceEntries })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(screen.getByRole('tree', { name: 'alpha' })).getByText('README.md').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    openTreeContextMenu('README.md')
    await chooseTreeMenuItem('重命名')
    const renameDialog = await waitFor(() => screen.getByRole('dialog', { name: '重命名' }))
    fireEvent.change(within(renameDialog).getByLabelText('名称'), { target: { value: 'GUIDE.md' } })
    fireEvent.click(within(renameDialog).getByRole('button', { name: '重命名' }))
    await waitFor(() => { expect(screen.getByRole('tab', { name: /GUIDE\.md/ })).toBeTruthy() })
    expect(b.renamePath).toHaveBeenCalledWith(WID, `${ROOT}/README.md`, 'GUIDE.md')
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('renames a folder from the tree context menu and reloads the parent layer', async () => {
    let renamed = false
    const renamePath = vi.fn(async (_id: WorkspaceId, path: string, newName: string) => {
      renamed = true
      return { path: path.replace(/[^/]+$/, newName) }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT && renamed) {
        return {
          path,
          entries: DEFAULT_ROOT.map(item => (
            item.name === 'src' ? entry('lib', true) : item
          )),
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const b = mount({ list: listWorkspaceEntries, renamePath })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    openTreeContextMenu('src')
    await chooseTreeMenuItem('重命名')
    const renameDialog = await waitFor(() => screen.getByRole('dialog', { name: '重命名' }))
    fireEvent.change(within(renameDialog).getByLabelText('名称'), { target: { value: 'lib' } })
    fireEvent.click(within(renameDialog).getByRole('button', { name: '重命名' }))
    await waitFor(() => { expect(screen.getByText('lib')).toBeTruthy() })
    expect(b.renamePath).toHaveBeenCalledWith(WID, `${ROOT}/src`, 'lib')
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('rename-folder: remaps open child tabs and delete closes them at the new path', async () => {
    const TEST = `${ROOT}/test`
    const TEST02 = `${ROOT}/test02`
    let folderName = 'test'
    let folderPresent = true
    const renamePath = vi.fn(async (_id: WorkspaceId, path: string, newName: string) => {
      folderName = newName
      return { path: path.replace(/[^/]+$/, newName) }
    })
    const deletePath = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === TEST02) folderPresent = false
      return { path }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) {
        const entries = DEFAULT_ROOT.filter(entry => entry.name !== 'src')
        if (folderPresent) entries.push(entry(folderName, true))
        return { path, entries, truncated: false }
      }
      if (path === TEST && folderName === 'test') {
        return {
          path,
          entries: [
            { name: 'test01.md', path: `${TEST}/test01.md`, isDirectory: false, hidden: false },
            { name: 'test02.md', path: `${TEST}/test02.md`, isDirectory: false, hidden: false },
          ],
          truncated: false,
        }
      }
      if (path === TEST02 && folderName === 'test02') {
        return {
          path,
          entries: [
            { name: 'test01.md', path: `${TEST02}/test01.md`, isDirectory: false, hidden: false },
            { name: 'test02.md', path: `${TEST02}/test02.md`, isDirectory: false, hidden: false },
          ],
          truncated: false,
        }
      }
      return listingFor(path)
    })
    mount({ list: listWorkspaceEntries, renamePath, deletePath })
    await waitFor(() => { expect(screen.getByText('test')).toBeTruthy() })
    await selectRow('test')
    await waitFor(() => { expect(screen.getByText('test01.md')).toBeTruthy() })
    await selectRow('test01.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /test01\.md/ })).toBeTruthy() })
    await selectRow('test02.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /test02\.md/ })).toBeTruthy() })
    openTreeContextMenu('test')
    await chooseTreeMenuItem('重命名')
    const renameDialog = await waitFor(() => screen.getByRole('dialog', { name: '重命名' }))
    fireEvent.change(within(renameDialog).getByLabelText('名称'), { target: { value: 'test02' } })
    fireEvent.click(within(renameDialog).getByRole('button', { name: '重命名' }))
    await waitFor(() => { expect(screen.getByText('test02')).toBeTruthy() })
    expect(screen.getByRole('tab', { name: /test01\.md/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /test02\.md/ })).toBeTruthy()
    openTreeContextMenu('test02')
    await chooseTreeMenuItem('删除')
    fireEvent.click(within(await waitFor(() => screen.getByRole('dialog', { name: '删除' })))
      .getByRole('button', { name: '删除' }))
    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /test01\.md/ })).toBeNull()
      expect(screen.queryByRole('tab', { name: /test02\.md/ })).toBeNull()
    })
    expect(deletePath).toHaveBeenCalledWith(WID, TEST02)
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
    openTreeContextMenu('untracked.ts')
    await chooseTreeMenuItem('重命名')
    const renameDialog = await waitFor(() => screen.getByRole('dialog', { name: '重命名' }))
    fireEvent.change(within(renameDialog).getByLabelText('名称'), { target: { value: 'README.md' } })
    fireEvent.click(within(renameDialog).getByRole('button', { name: '重命名' }))
    await waitFor(() => { expect(screen.getByText('已存在同名文件')).toBeTruthy() })
    expect(b.renamePath).not.toHaveBeenCalled()
  })

  it('new-file-after-subfolder: shows folder conflict copy when the name is taken by a directory', async () => {
    const testPath = `${ROOT}/test`
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) {
        return {
          path,
          entries: [...DEFAULT_ROOT, entry('test', true)],
          truncated: false,
        }
      }
      if (path === testPath) {
        return {
          path,
          entries: [entry('test01', true)],
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const writeFile = vi.fn(async () => ({ path: `${testPath}/test01` }))
    mount({ list: listWorkspaceEntries, write: writeFile })
    await waitFor(() => { expect(screen.getByText('test')).toBeTruthy() })
    openTreeContextMenu('test', { directory: true })
    await chooseTreeMenuItem('新建文件')
    const fileDialog = await waitFor(() => screen.getByRole('dialog', { name: '新建文件' }))
    fireEvent.change(within(fileDialog).getByLabelText('名称'), { target: { value: 'test01' } })
    fireEvent.click(within(fileDialog).getByRole('button', { name: '创建' }))
    await waitFor(() => {
      expect(screen.getByText('已存在同名文件夹')).toBeTruthy()
    })
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('delete-open-tab: keeps tree visible after deleting the active editor file', async () => {
    let deleted = false
    const deletePath = vi.fn(async (_id: WorkspaceId, path: string) => {
      deleted = true
      return { path }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path !== ROOT) return listingFor(path)
      if (deleted) {
        await new Promise<void>((resolve) => { setTimeout(resolve, 30) })
        return {
          path,
          entries: DEFAULT_ROOT.filter(entry => entry.name !== 'untracked.ts'),
          truncated: false,
        }
      }
      return listingFor(path)
    })
    mount({ list: listWorkspaceEntries, deletePath })
    await waitFor(() => { expect(screen.getByText('untracked.ts')).toBeTruthy() })
    await selectRow('untracked.ts')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /untracked\.ts/ })).toBeTruthy() })
    openTreeContextMenu('untracked.ts')
    await chooseTreeMenuItem('删除')
    fireEvent.click(within(await waitFor(() => screen.getByRole('dialog', { name: '删除' })))
      .getByRole('button', { name: '删除' }))
    const tree = () => screen.getByRole('tree', { name: 'alpha' })
    await waitFor(() => {
      expect(within(tree()).getByText('README.md')).toBeTruthy()
      expect(within(tree()).queryByText('untracked.ts')).toBeNull()
    })
  })

  it('delete-confirm: requires explicit confirmation before deleting', async () => {
    let deleted = false
    const deletePath = vi.fn(async (_id: WorkspaceId, path: string) => {
      deleted = true
      return { path }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT && deleted) {
        return {
          path,
          entries: DEFAULT_ROOT.filter(entry => entry.name !== 'untracked.ts'),
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const b = mount({ list: listWorkspaceEntries, deletePath })
    await waitFor(() => { expect(screen.getByText('untracked.ts')).toBeTruthy() })
    await selectRow('untracked.ts')
    openTreeContextMenu('untracked.ts')
    await chooseTreeMenuItem('删除')
    const deleteDialog = await waitFor(() => screen.getByRole('dialog', { name: '删除' }))
    expect(b.deletePath).not.toHaveBeenCalled()
    fireEvent.click(within(deleteDialog).getByRole('button', { name: '取消' }))
    expect(b.deletePath).not.toHaveBeenCalled()
    openTreeContextMenu('untracked.ts')
    await chooseTreeMenuItem('删除')
    const confirmDialog = await waitFor(() => screen.getByRole('dialog', { name: '删除' }))
    fireEvent.click(within(confirmDialog).getByRole('button', { name: '删除' }))
    const tree = () => screen.getByRole('tree', { name: 'alpha' })
    await waitFor(() => {
      expect(within(tree()).queryByText('untracked.ts')).toBeNull()
      expect(within(tree()).getByText('README.md')).toBeTruthy()
    })
    expect(b.deletePath).toHaveBeenCalledWith(WID, `${ROOT}/untracked.ts`)
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('deletes a folder from the tree context menu and reloads the parent layer', async () => {
    let deleted = false
    const deletePath = vi.fn(async (_id: WorkspaceId, path: string) => {
      deleted = true
      return { path }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT && deleted) {
        return {
          path,
          entries: DEFAULT_ROOT.filter(entry => entry.name !== 'src'),
          truncated: false,
        }
      }
      return listingFor(path)
    })
    const b = mount({ list: listWorkspaceEntries, deletePath })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    openTreeContextMenu('src')
    await chooseTreeMenuItem('删除')
    fireEvent.click(within(await waitFor(() => screen.getByRole('dialog', { name: '删除' })))
      .getByRole('button', { name: '删除' }))
    const tree = () => screen.getByRole('tree', { name: 'alpha' })
    await waitFor(() => {
      expect(within(tree()).queryByText('src')).toBeNull()
      expect(within(tree()).getByText('README.md')).toBeTruthy()
    })
    expect(b.deletePath).toHaveBeenCalledWith(WID, `${ROOT}/src`)
    expect(listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length).toBeGreaterThan(1)
  })

  it('delete-folder: closes open tabs under the deleted directory', async () => {
    let deleted = false
    const deletePath = vi.fn(async (_id: WorkspaceId, path: string) => {
      deleted = true
      return { path }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT && deleted) {
        return {
          path,
          entries: DEFAULT_ROOT.filter(entry => entry.name !== 'src'),
          truncated: false,
        }
      }
      return listingFor(path)
    })
    mount({ list: listWorkspaceEntries, deletePath })
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    await selectRow('src')
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    await selectRow('app.ts')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /app\.ts/ })).toBeTruthy() })
    await selectRow('README.md')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy() })
    openTreeContextMenu('src')
    await chooseTreeMenuItem('删除')
    fireEvent.click(within(await waitFor(() => screen.getByRole('dialog', { name: '删除' })))
      .getByRole('button', { name: '删除' }))
    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /app\.ts/ })).toBeNull()
      expect(screen.getByRole('tab', { name: /README\.md/ })).toBeTruthy()
    })
  })

  it('delete-folder-recreate: does not resurrect cached children for a reused folder name', async () => {
    const TEST03 = `${ROOT}/test03`
    let test03Present = true
    let test03HadChildren = true
    const deletePath = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === TEST03) {
        test03Present = false
        test03HadChildren = false
      }
      return { path }
    })
    const createWorkspaceDirectory = vi.fn(async (_id: WorkspaceId, parent: string, name: string) => {
      if (parent === ROOT && name === 'test03') test03Present = true
      return { path: `${parent}/${name}` }
    })
    const listWorkspaceEntries = vi.fn(async (_id: WorkspaceId, path: string) => {
      if (path === ROOT) {
        const entries = DEFAULT_ROOT.filter(entry => entry.name !== 'src')
        if (test03Present) entries.push(entry('test03', true))
        return { path, entries, truncated: false }
      }
      if (path === TEST03) {
        if (!test03Present || !test03HadChildren) {
          return { path, entries: [], truncated: false }
        }
        return {
          path,
          entries: [
            entry('test03.md', false),
            { name: 'test03', path: `${TEST03}/test03`, isDirectory: false, hidden: false },
          ],
          truncated: false,
        }
      }
      return listingFor(path)
    })
    mount({ list: listWorkspaceEntries, deletePath, createWorkspaceDirectory })
    await waitFor(() => { expect(within(screen.getByRole('tree', { name: 'alpha' })).getAllByText('test03').length).toBeGreaterThan(0) })
    await selectRow('test03')
    await waitFor(() => { expect(screen.getByText('test03.md')).toBeTruthy() })
    openTreeContextMenu('test03', { directory: true })
    await chooseTreeMenuItem('删除')
    fireEvent.click(within(await waitFor(() => screen.getByRole('dialog', { name: '删除' })))
      .getByRole('button', { name: '删除' }))
    await waitFor(() => { expect(screen.queryByText('test03.md')).toBeNull() })
    fireEvent.click(toolbarButton('新建文件夹'))
    const folderDialog = await waitFor(() => screen.getByRole('dialog', { name: '新建文件夹' }))
    fireEvent.change(within(folderDialog).getByLabelText('名称'), { target: { value: 'test03' } })
    fireEvent.click(within(folderDialog).getByRole('button', { name: '创建' }))
    await waitFor(() => {
      expect(within(screen.getByRole('tree', { name: 'alpha' })).getAllByText('test03')).toHaveLength(1)
    })
    await selectRow('test03')
    await waitFor(() => { expect(screen.queryByText('test03.md')).toBeNull() })
  })

  it('delete-submitting: disables the confirm button while deletion is in flight', async () => {
    let release!: () => void
    const deletePath = vi.fn(() => new Promise<{ path: string }>((resolve) => {
      release = () => { resolve({ path: `${ROOT}/untracked.ts` }) }
    }))
    mount({ deletePath })
    await waitFor(() => { expect(screen.getByText('untracked.ts')).toBeTruthy() })
    await selectRow('untracked.ts')
    openTreeContextMenu('untracked.ts')
    await chooseTreeMenuItem('删除')
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
    openTreeContextMenu('untracked.ts')
    await chooseTreeMenuItem('删除')
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

  it('watch-change-dirty: a fake watch event reloads from disk even with unsaved local edits', async () => {
    const watch = createWatchHarness()
    const readCounts = new Map<string, number>()
    const b = mount({
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
    await waitFor(() => { expect(b.listWorkspaceEntries).toHaveBeenCalledWith(WID, ROOT, expect.any(AbortSignal)) })
    const initialRootListings = b.listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length
    await clickFile('README.md')
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'local edits\n' } })
    expect(screen.getByLabelText('未保存')).toBeTruthy()
    box.focus()
    expect(watch.watchPath).toHaveBeenCalledWith(WID, README, expect.any(Function), expect.any(AbortSignal))
    await act(async () => { watch.trigger(README) })
    await waitFor(async () => { expect((await markdownEditor()).value).toBe('external\n') })
    expect(screen.queryByRole('dialog', { name: '文件已在磁盘上更改' })).toBeNull()
    expect(screen.queryByLabelText('未保存')).toBeNull()
    expect(b.listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length)
      .toBe(initialRootListings)
  })

  it('watch-change-clean: a fake watch event reloads a saved open tab from disk without a dialog', async () => {
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
    await markdownEditor()
    await act(async () => { watch.trigger(README) })
    await waitFor(async () => { expect((await markdownEditor()).value).toBe('external\n') })
    expect(screen.queryByRole('dialog', { name: '文件已在磁盘上更改' })).toBeNull()
    expect(screen.queryByLabelText('未保存')).toBeNull()
  })

  it('watch-stale-read-retry: retries when the first post-watch read still matches saved', async () => {
    const watch = createWatchHarness()
    const readCounts = new Map<string, number>()
    mount({
      watchPath: watch.watchPath,
      read: async (_id, path, kind) => {
        if (kind !== 'text') return defaultReadFile(_id, path, kind)
        const count = (readCounts.get(path) ?? 0) + 1
        readCounts.set(path, count)
        if (count <= 2) return { kind: 'text' as const, path, text: 'initial\n' }
        return { kind: 'text' as const, path, text: 'external\n' }
      },
    })
    await clickFile('README.md')
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'local edits\n' } })
    box.focus()
    await act(async () => { watch.trigger(README) })
    await waitFor(async () => { expect((await markdownEditor()).value).toBe('external\n') }, { timeout: 1000 })
  })

  it('watch-second-write: a later agent write reloads even when stale reads match the current buffer', async () => {
    const watch = createWatchHarness()
    const readCounts = new Map<string, number>()
    const staleReadsRemaining = new Map<string, number>()
    mount({
      watchPath: watch.watchPath,
      read: async (_id, path, kind) => {
        if (kind !== 'text') return defaultReadFile(_id, path, kind)
        const count = (readCounts.get(path) ?? 0) + 1
        readCounts.set(path, count)
        if (count === 1) return { kind: 'text' as const, path, text: 'initial\n' }
        const staleLeft = staleReadsRemaining.get(path) ?? 0
        if (staleLeft > 0) {
          staleReadsRemaining.set(path, staleLeft - 1)
          return { kind: 'text' as const, path, text: 'first\n' }
        }
        if (count <= 3) return { kind: 'text' as const, path, text: 'first\n' }
        return { kind: 'text' as const, path, text: 'second\n' }
      },
    })
    await clickFile('README.md')
    await markdownEditor()
    staleReadsRemaining.set(README, 1)
    await act(async () => { watch.trigger(README) })
    await waitFor(async () => { expect((await markdownEditor()).value).toBe('first\n') })
    staleReadsRemaining.set(README, 2)
    await act(async () => { watch.trigger(README) })
    await waitFor(async () => { expect((await markdownEditor()).value).toBe('second\n') }, { timeout: 2000 })
  })

  it('git-disk-change: shell notification reloads open tabs from disk without a dialog', async () => {
    const readCounts = new Map<string, number>()
    const b = mount({
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
    await markdownEditor()
    b.view.rerender(<EditorSurface {...b.props} diskPathsChangedEpoch={1} diskPathsChanged={[README]} />)
    await waitFor(async () => { expect((await markdownEditor()).value).toBe('external\n') })
    expect(screen.queryByRole('dialog', { name: '文件已在磁盘上更改' })).toBeNull()
  })

  it('watch-all-open-tabs: every open text tab keeps a watch subscription', async () => {
    const watch = createWatchHarness()
    const gone = `${ROOT}/gone.ts`
    mount({ watchPath: watch.watchPath })
    expect(watch.isWatching(ROOT)).toBe(true)
    await clickFile('README.md')
    await markdownEditor()
    expect(watch.isWatching(README)).toBe(true)
    await clickFile('gone.ts')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /gone\.ts/ })).toBeTruthy() })
    expect(watch.isWatching(README)).toBe(true)
    expect(watch.isWatching(gone)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }))
    await waitFor(() => { expect(screen.queryByRole('tab', { name: /README\.md/ })).toBeNull() })
    expect(watch.isWatching(README)).toBe(false)
    expect(watch.isWatching(gone)).toBe(true)
  })

  it('watch-background-dirty: agent write reloads a dirty background tab while another tab stays focused', async () => {
    const watch = createWatchHarness()
    const readCounts = new Map<string, number>()
    mount({
      watchPath: watch.watchPath,
      read: async (_id, path, kind) => {
        if (kind !== 'text') return defaultReadFile(_id, path, kind)
        const count = (readCounts.get(path) ?? 0) + 1
        readCounts.set(path, count)
        if (path === README) {
          return {
            kind: 'text' as const,
            path,
            text: count === 1 ? 'initial\n' : 'external\n',
          }
        }
        return defaultReadFile(_id, path, kind)
      },
    })
    await clickFile('README.md')
    const readme = await markdownEditor()
    fireEvent.change(readme, { target: { value: 'local edits\n' } })
    await clickFile('gone.ts')
    await waitFor(() => { expect(screen.getByRole('tab', { name: /gone\.ts/ })).toBeTruthy() })
    expect(watch.isWatching(README)).toBe(true)
    await act(async () => { watch.trigger(README) })
    fireEvent.click(screen.getByRole('tab', { name: /README\.md/ }))
    await waitFor(async () => { expect((await markdownEditor()).value).toBe('external\n') })
    expect(screen.queryByLabelText('未保存')).toBeNull()
  })

  it('many-tabs: a sixth text tab opens and directory listing still works', async () => {
    const extra = entry('extra.ts', false)
    const watch = createWatchHarness()
    const list = vi.fn(async (_id: WorkspaceId, path: string) => {
      const base = listingFor(path)
      if (path === ROOT) {
        return { ...base, entries: [...base.entries, extra] }
      }
      return base
    })
    const { listWorkspaceEntries } = mount({ watchPath: watch.watchPath, list })
    for (const name of ['README.md', 'gone.ts', 'untracked.ts', '.gitignore', 'extra.ts']) {
      await clickFile(name)
      if (name.endsWith('.md')) await markdownEditor(name)
      else await waitFor(() => { expect(screen.getByRole('tab', { name: new RegExp(name.replace('.', '\\.')) })).toBeTruthy() })
    }
    const tree = screen.getByRole('tree', { name: 'alpha' })
    fireEvent.click(within(tree).getByText('src').closest('[role="treeitem"]')!)
    await waitFor(() => {
      expect(listWorkspaceEntries).toHaveBeenCalledWith(WID, `${ROOT}/src`, expect.any(AbortSignal))
    })
    fireEvent.click(within(tree).getByText('app.ts').closest('[role="treeitem"]')!)
    await waitFor(() => { expect(screen.getByRole('tab', { name: /app\.ts/ })).toBeTruthy() })
    expect(watch.isWatching(`${ROOT}/src/app.ts`)).toBe(true)
    expect(watch.isWatching(`${ROOT}/README.md`)).toBe(true)
    fireEvent.click(within(tree).getByText('node_modules').closest('[role="treeitem"]')!)
    await waitFor(() => {
      expect(listWorkspaceEntries).toHaveBeenCalledWith(WID, `${ROOT}/node_modules`, expect.any(AbortSignal))
    })
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
    expect(watch.isWatching(ROOT)).toBe(true)
    await act(async () => { watch.trigger(README) })
    expect(screen.queryByRole('dialog', { name: '文件已在磁盘上更改' })).toBeNull()
    expect(b.watchPath.mock.calls.some(call => call[1] === ROOT)).toBe(true)
  })

  it('workspace-watch-refreshes-tree: a workspace-root watch event re-lists visible directories', async () => {
    const watch = createWatchHarness()
    const agentFile = entry('agent.ts', false)
    const list = vi.fn(async (_id: WorkspaceId, path: string) => {
      const base = listingFor(path)
      if (path === ROOT) {
        return { ...base, entries: [...base.entries, agentFile] }
      }
      return base
    })
    const b = mount({ watchPath: watch.watchPath, list })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const initialRootListings = b.listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length
    await act(async () => { watch.trigger(ROOT) })
    await waitFor(() => {
      expect(b.listWorkspaceEntries.mock.calls.filter(call => call[1] === ROOT).length)
        .toBeGreaterThan(initialRootListings)
    }, { timeout: 3000 })
    await waitFor(() => { expect(screen.getByText('agent.ts')).toBeTruthy() })
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
    const box = await markdownEditor()
    fireEvent.change(box, { target: { value: 'local edits\n' } })
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

  it('publishes dirty editor-tab paths and clears them after save', async () => {
    const setDirtyPaths = vi.fn()
    mount({ setDirtyPaths })
    await dirtyReadme()
    await waitFor(() => {
      expect(setDirtyPaths).toHaveBeenCalledWith([README])
    })
    saveShortcut()
    await waitFor(() => {
      expect(setDirtyPaths).toHaveBeenCalledWith([])
    })
  })
})
