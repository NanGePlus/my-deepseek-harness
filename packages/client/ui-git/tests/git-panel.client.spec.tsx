// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  GitDiffPreview, GitLogEntry, GitWorkingTreeChange, GitWorkingTreeResult, SessionId, SessionListState,
  WorkspaceId, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore, DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { GitPanel, type GitPanelProps } from '../src/client/GitPanel.tsx'
import { CONFIRM_POPOVER_GAP } from '../src/client/git-confirm-popover.ts'
import { GIT_GRAPH_LANE_WIDTH } from '../src/client/git-graph-layout.ts'
import { createGitPanelStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const SID = 's1' as SessionId
const SID2 = 's2' as SessionId
const WID = 'ws1' as WorkspaceId
const WID2 = 'ws2' as WorkspaceId
const ROOT = '/w/alpha'
const LOG_DATE = '2026-08-27T02:06:00.000Z'

function logEntry(over: Partial<GitLogEntry> & Pick<GitLogEntry, 'hash' | 'shortHash' | 'subject'>): GitLogEntry {
  return {
    parents: [],
    authorName: 'Ada',
    authorDate: LOG_DATE,
    body: '',
    refs: [],
    ...over,
  }
}

function confirmCommit(): void {
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }))
}

function confirmCommitPush(): void {
  fireEvent.click(screen.getByRole('button', { name: '确认提交并推送' }))
}

function confirmPush(): void {
  fireEvent.click(screen.getByRole('button', { name: '确认推送' }))
}

function confirmRemoveRemote(): void {
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
}

function mockAnchorRect(el: HTMLElement, right: number, bottom: number): void {
  el.getBoundingClientRect = () => ({
    x: right - 120, y: bottom - 28, left: right - 120, top: bottom - 28,
    right, bottom, width: 120, height: 28, toJSON() { return {} },
  })
}

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

function change(
  path: string,
  kind: GitWorkingTreeChange['kind'],
  root = '/repos/app',
): GitWorkingTreeChange {
  return { path, absolutePath: `${root}/${path}`, kind }
}

const CLEAN_REPO: GitWorkingTreeResult = {
  availability: 'repository',
  repoRoot: '/repos/app',
  branch: 'main',
  unstaged: [],
  staged: [],
  pushAvailable: false,
}

const AHEAD_REPO: GitWorkingTreeResult = {
  ...CLEAN_REPO,
  ahead: 2,
  pushAvailable: true,
}

const UNPUBLISHED_REPO: GitWorkingTreeResult = {
  ...CLEAN_REPO,
  pushAvailable: true,
}

const NO_REMOTE_REPO: GitWorkingTreeResult = {
  ...CLEAN_REPO,
  hasRemote: false,
  pushAvailable: true,
}

const ORIGIN_REPO: GitWorkingTreeResult = {
  ...CLEAN_REPO,
  hasRemote: true,
  originUrl: 'https://github.com/org/repo.git',
}

const DIRTY_REPO: GitWorkingTreeResult = {
  availability: 'repository',
  repoRoot: '/repos/app',
  branch: 'HEAD detached at abc1234',
  pushAvailable: false,
  unstaged: [
    change('src/a.ts', 'modified'),
    change('README.md', 'modified'),
  ],
  staged: [
    change('src/a.ts', 'modified'),
    change('docs/note.md', 'modified'),
  ],
}

const DISCARD_REPO: GitWorkingTreeResult = {
  availability: 'repository',
  repoRoot: '/repos/app',
  branch: 'main',
  pushAvailable: false,
  unstaged: [
    change('tracked.ts', 'modified'),
    change('new.ts', 'untracked'),
    change('gone.ts', 'deleted'),
  ],
  staged: [],
}

const TEXT_PREVIEW: GitDiffPreview = {
  kind: 'text',
  fileText: 'keep\nnew\nline4\nline5\nline6\nline7\npad\ntail-new\n',
  hunks: [
    {
      header: '@@ -1,3 +1,3 @@',
      lines: [
        { origin: 'context', text: 'keep' },
        { origin: 'del', text: 'old' },
        { origin: 'add', text: 'new' },
      ],
    },
    {
      header: '@@ -8,2 +8,2 @@',
      lines: [
        { origin: 'del', text: 'tail-old' },
        { origin: 'add', text: 'tail-new' },
      ],
    },
  ],
}

const STAGED_TEXT_PREVIEW: GitDiffPreview = {
  kind: 'text',
  fileText: TEXT_PREVIEW.fileText,
  hunks: [TEXT_PREVIEW.hunks[0]!],
}

const PREVIEW_KINDS_REPO: GitWorkingTreeResult = {
  availability: 'repository',
  repoRoot: '/repos/app',
  branch: 'main',
  pushAvailable: false,
  unstaged: [
    change('src/a.ts', 'modified'),
    change('new.ts', 'untracked'),
    change('photo.bin', 'modified'),
    change('gone.ts', 'deleted'),
    change('blob.bin', 'deleted'),
    change('conflict.ts', 'modified'),
    change('outside.ts', 'modified', '/repos'),
  ],
  staged: [
    change('src/a.ts', 'modified'),
  ],
}

function mount(over: {
  visible?: boolean
  dirtyPaths?: readonly string[]
  items?: WorkspaceView[]
  sessionId?: SessionId
  noCurrentSession?: boolean
  tree?: GitWorkingTreeResult | Promise<GitWorkingTreeResult>
  gitWorkingTree?: GitPanelProps['gitWorkingTree']
  gitInit?: GitPanelProps['gitInit']
  gitDiffPreview?: GitPanelProps['gitDiffPreview']
  gitStage?: GitPanelProps['gitStage']
  gitUnstage?: GitPanelProps['gitUnstage']
  gitDiscard?: GitPanelProps['gitDiscard']
  gitCommit?: GitPanelProps['gitCommit']
  gitPush?: GitPanelProps['gitPush']
  gitAddRemote?: GitPanelProps['gitAddRemote']
  gitRemoveRemote?: GitPanelProps['gitRemoveRemote']
  gitLog?: GitPanelProps['gitLog']
  gitCommitDiff?: GitPanelProps['gitCommitDiff']
  notifyDiskPathsChanged?: GitPanelProps['notifyDiskPathsChanged']
} = {}) {
  const gitWorkingTree = vi.fn(over.gitWorkingTree ?? (async () => {
    if (over.tree !== undefined) return over.tree
    return CLEAN_REPO
  }))
  const gitInit = vi.fn(over.gitInit ?? (async () => ({ repoRoot: ROOT })))
  const gitDiffPreview = vi.fn(over.gitDiffPreview ?? (async () => TEXT_PREVIEW))
  const gitStage = vi.fn(over.gitStage ?? (async () => CLEAN_REPO))
  const gitUnstage = vi.fn(over.gitUnstage ?? (async () => CLEAN_REPO))
  const gitDiscard = vi.fn(over.gitDiscard ?? (async () => CLEAN_REPO))
  const gitCommit = vi.fn(over.gitCommit ?? (async () => CLEAN_REPO))
  const gitPush = vi.fn(over.gitPush ?? (async () => CLEAN_REPO))
  const gitAddRemote = vi.fn(over.gitAddRemote ?? (async () => CLEAN_REPO))
  const gitRemoveRemote = vi.fn(over.gitRemoveRemote ?? (async () => CLEAN_REPO))
  const gitLog = vi.fn(over.gitLog ?? (async () => ({
    availability: 'repository' as const,
    repoRoot: ROOT,
    commits: [],
    hasMore: false,
  })))
  const gitCommitDiff = vi.fn(over.gitCommitDiff ?? (async () => ({
    availability: 'repository' as const,
    hash: 'a'.repeat(40),
    files: [],
    truncated: false,
  })))
  const notifyDiskPathsChanged = vi.fn(over.notifyDiskPathsChanged)
  const items = over.items ?? [workspace()]
  const workspacesStore = createSnapshotStore(workspacesState(items))
  const sessionsStore = createSnapshotStore(sessionsState(
    over.noCurrentSession ? undefined : (over.sessionId ?? SID),
  ))
  const panelStore = createGitPanelStore().create()
  const props = {
    visible: over.visible ?? true,
    dirtyPaths: over.dirtyPaths ?? [],
    notifyDiskPathsChanged,
    t: makeTranslate(zh),
    useSessions: hookOf(sessionsStore),
    useWorkspaces: hookOf(workspacesStore),
    useStore: hookOf(panelStore),
    actions: panelStore.actions,
    gitWorkingTree,
    gitInit,
    gitDiffPreview,
    gitStage,
    gitUnstage,
    gitDiscard,
    gitCommit,
    gitPush,
    gitAddRemote,
    gitRemoveRemote,
    gitLog,
    gitCommitDiff,
  } as GitPanelProps
  const view = render(<GitPanel {...props} />)
  return {
    view, props, sessionsStore, workspacesStore, panelStore,
    gitWorkingTree, gitInit, gitDiffPreview, gitStage, gitUnstage, gitDiscard, gitCommit, gitLog,
    gitCommitDiff,
    gitAddRemote,
    gitRemoveRemote,
    notifyDiskPathsChanged,
  }
}

describe('GitPanel', () => {
  it('does not read the working tree while the Git tab is hidden', async () => {
    const b = mount({ visible: false })
    await act(async () => { await Promise.resolve() })
    expect(b.gitWorkingTree).not.toHaveBeenCalled()
    expect(screen.queryByText('加载中…')).toBeNull()
  })

  it('loading-list: shows a centered spinner until the first working-tree read settles', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const pending = new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve })
    mount({ gitWorkingTree: vi.fn(() => pending) })
    expect(screen.getByText('加载中…')).toBeTruthy()
    expect(screen.getByRole('status', { name: '加载中…' })).toBeTruthy()
    await act(async () => { settle(CLEAN_REPO) })
    await waitFor(() => { expect(screen.queryByText('加载中…')).toBeNull() })
  })

  it('empty-unavailable: shows Git 不可用 without an initialize action', async () => {
    mount({ tree: { availability: 'git-unavailable' } })
    await waitFor(() => { expect(screen.getByText('Git 不可用')).toBeTruthy() })
    expect(screen.getByText('找不到可用的 git。安装 git 并确保它在 PATH 中。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '初始化仓库' })).toBeNull()
    expect(screen.queryByText('不是 Git 仓库')).toBeNull()
  })

  it('empty-not-repo: shows 不是 Git 仓库 and initializes at the bound Workspace', async () => {
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce({ availability: 'not-a-repository' })
      .mockResolvedValueOnce(CLEAN_REPO)
    const gitInit = vi.fn(async () => ({ repoRoot: ROOT }))
    mount({ gitWorkingTree, gitInit })
    await waitFor(() => { expect(screen.getByText('不是 Git 仓库')).toBeTruthy() })
    expect(screen.getByText('当前绑定目录向上找不到 Git 仓库。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '初始化仓库' }))
    await waitFor(() => { expect(gitInit).toHaveBeenCalledWith(WID) })
    await waitFor(() => { expect(screen.getByText('提交到分支 main')).toBeTruthy() })
    expect(screen.queryByRole('button', { name: '初始化仓库' })).toBeNull()
  })

  it('empty-not-repo: keeps the overlay when initialize fails', async () => {
    const gitInit = vi.fn(async () => {
      throw new DirectoryBrowseError({ code: 'git-failed', message: 'init denied', details: {} })
    })
    mount({ tree: { availability: 'not-a-repository' }, gitInit })
    await waitFor(() => { expect(screen.getByRole('button', { name: '初始化仓库' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '初始化仓库' }))
    await waitFor(() => { expect(screen.getByText('init denied')).toBeTruthy() })
    expect(screen.getByText('不是 Git 仓库')).toBeTruthy()
    expect(screen.getByRole('button', { name: '初始化仓库' })).toBeTruthy()
  })

  it('empty-clean: keeps the commit placeholder and disables submit when the index is empty', async () => {
    mount({ tree: CLEAN_REPO })
    await waitFor(() => { expect(screen.getByText('提交到分支 main')).toBeTruthy() })
    expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
    expect(screen.getByText('选择一个文件或 Graph 中的提交以查看差异')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '初始化仓库' })).toBeNull()
    expect(screen.queryByRole('button', { name: '推送' })).toBeNull()
    expect(screen.queryByText('有 2 个提交尚未推送')).toBeNull()
    expect(screen.queryByText('尚未推送到远程')).toBeNull()
  })

  it('graph: does not open the newest commit in the preview until the user selects one', async () => {
    const first = 'a'.repeat(40)
    const second = 'b'.repeat(40)
    const gitCommitDiff = vi.fn(async (_id: WorkspaceId, hash: string) => ({
      availability: 'repository' as const,
      hash,
      files: [],
      truncated: false,
    }))
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [
          logEntry({ hash: first, shortHash: 'aaa', subject: 'one' }),
          logEntry({ hash: second, shortHash: 'bbb', subject: 'two' }),
        ],
        hasMore: false,
      })),
      gitCommitDiff,
    })
    await waitFor(() => { expect(screen.getByText('one')).toBeTruthy() })
    expect(screen.getByText('选择一个文件或 Graph 中的提交以查看差异')).toBeTruthy()
    expect(gitCommitDiff).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '提交 two' }))
    await waitFor(() => { expect(gitCommitDiff).toHaveBeenCalledWith(WID, second, expect.any(AbortSignal)) })
    expect(screen.queryByText('选择一个文件或 Graph 中的提交以查看差异')).toBeNull()
  })

  it('graph: keeps the last opened commit after hiding and showing the Git tab', async () => {
    const first = 'a'.repeat(40)
    const second = 'b'.repeat(40)
    const gitCommitDiff = vi.fn(async (_id: WorkspaceId, hash: string) => ({
      availability: 'repository' as const,
      hash,
      files: [],
      truncated: false,
    }))
    const gitLog = vi.fn(async () => ({
      availability: 'repository' as const,
      repoRoot: ROOT,
      commits: [
        logEntry({ hash: first, shortHash: 'aaa', subject: 'one' }),
        logEntry({ hash: second, shortHash: 'bbb', subject: 'two' }),
      ],
      hasMore: false,
    }))
    const b = mount({ tree: CLEAN_REPO, gitLog, gitCommitDiff })
    await waitFor(() => { expect(screen.getByText('one')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 two' }))
    await waitFor(() => { expect(gitCommitDiff).toHaveBeenCalledWith(WID, second, expect.any(AbortSignal)) })
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={false} />) })
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={true} />) })
    await waitFor(() => { expect(screen.getByText('two')).toBeTruthy() })
    expect(gitCommitDiff.mock.calls.at(-1)?.[1]).toBe(second)
  })

  it('graph: keeps loaded commits visible while gitLog refreshes after the Git tab is shown', async () => {
    const first = 'a'.repeat(40)
    const second = 'b'.repeat(40)
    let settleRefresh!: (log: {
      availability: 'repository'
      repoRoot: string
      commits: GitLogEntry[]
      hasMore: boolean
    }) => void
    const gitLog = vi.fn(async () => ({
      availability: 'repository' as const,
      repoRoot: ROOT,
      commits: [logEntry({ hash: first, shortHash: 'aaa', subject: 'one' })],
      hasMore: false,
    }))
    const b = mount({ tree: CLEAN_REPO, gitLog })
    await waitFor(() => { expect(screen.getByText('one')).toBeTruthy() })
    gitLog.mockImplementation(() => new Promise((resolve) => { settleRefresh = resolve }))
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={false} />) })
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={true} />) })
    expect(screen.getByText('one')).toBeTruthy()
    expect(screen.queryByText('加载提交历史…')).toBeNull()
    expect(gitLog.mock.calls.length).toBeGreaterThan(1)
    await act(async () => {
      settleRefresh({
        availability: 'repository',
        repoRoot: ROOT,
        commits: [
          logEntry({ hash: first, shortHash: 'aaa', subject: 'one' }),
          logEntry({ hash: second, shortHash: 'bbb', subject: 'two' }),
        ],
        hasMore: false,
      })
    })
    await waitFor(() => { expect(screen.getByText('two')).toBeTruthy() })
  })

  it('keeps a file preview visible while it re-reads after the Git tab is shown', async () => {
    const gitDiffPreview = vi.fn(async () => TEXT_PREVIEW)
    const b = mount({ tree: DIRTY_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => { expect(within(previewPane()).getByText('keep')).toBeTruthy() })
    gitDiffPreview.mockImplementation(() => new Promise(() => {}))
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={false} />) })
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={true} />) })
    expect(within(previewPane()).getByText('keep')).toBeTruthy()
    expect(within(previewPane()).queryByRole('status', { name: '加载中…' })).toBeNull()
    expect(gitDiffPreview.mock.calls.length).toBeGreaterThan(1)
  })

  it('graph: keeps a commit diff visible while it re-reads after the Git tab is shown', async () => {
    const hash = 'c'.repeat(40)
    const gitCommitDiff = vi.fn()
      .mockResolvedValueOnce({
        availability: 'repository' as const,
        hash,
        files: [{
          path: 'src/app.ts',
          status: 'modified' as const,
          preview: TEXT_PREVIEW,
        }],
        truncated: false,
      })
      .mockImplementationOnce(() => new Promise(() => {}))
    const b = mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({ hash, shortHash: 'ccc', subject: 'kept' })],
        hasMore: false,
      })),
      gitCommitDiff,
    })
    await waitFor(() => { expect(screen.getByText('kept')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 kept' }))
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    gitCommitDiff.mockImplementation(() => new Promise(() => {}))
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={false} />) })
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={true} />) })
    expect(screen.getByText('app.ts')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '差异预览' })).queryByRole('status', { name: '加载中…' })).toBeNull()
    expect(gitCommitDiff.mock.calls.length).toBeGreaterThan(1)
  })

  it('graph: reloading the log does not steal a working-tree file preview', async () => {
    const first = 'a'.repeat(40)
    const gitCommitDiff = vi.fn(async (_id: WorkspaceId, hash: string) => ({
      availability: 'repository' as const,
      hash,
      files: [],
      truncated: false,
    }))
    const b = mount({
      tree: DIRTY_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({ hash: first, shortHash: 'aaa', subject: 'one' })],
        hasMore: false,
      })),
      gitCommitDiff,
    })
    await waitFor(() => { expect(screen.getByText('one')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: '差异预览' })).getByText('README.md')).toBeTruthy()
    })
    expect(gitCommitDiff).not.toHaveBeenCalled()
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={false} />) })
    await act(async () => { b.view.rerender(<GitPanel {...b.props} visible={true} />) })
    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: '差异预览' })).getByText('README.md')).toBeTruthy()
    })
    expect(gitCommitDiff).not.toHaveBeenCalled()
  })

  it('graph: merge history draws a side-lane curve under Graph', async () => {
    const commits: GitLogEntry[] = [
      logEntry({
        hash: 'm'.repeat(40), shortHash: 'merge01', parents: ['a'.repeat(40), 'b'.repeat(40)],
        subject: 'Merge feature', refs: ['main', 'origin/main'],
      }),
      logEntry({
        hash: 'a'.repeat(40), shortHash: 'main001', parents: ['r'.repeat(40)],
        subject: 'main tip',
      }),
      logEntry({
        hash: 'b'.repeat(40), shortHash: 'feat001', parents: ['r'.repeat(40)],
        subject: 'feat: side',
      }),
      logEntry({
        hash: 'r'.repeat(40), shortHash: 'root001',
        subject: 'root',
      }),
    ]
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits,
        hasMore: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('Merge feature')).toBeTruthy() })
    expect(screen.getByText('feat: side')).toBeTruthy()
    expect(document.querySelector('[data-git-graph-merge="true"]')).toBeTruthy()
    expect(document.querySelector('[data-git-graph-merge="true"]')?.getAttribute('data-git-graph-lane')).toBe('0')
    const paths = [...document.querySelectorAll('#git-section-graph-list path')]
    expect(paths.some(path => (path.getAttribute('d') ?? '').includes('C'))).toBe(true)
    expect(screen.getByText('origin/main')).toBeTruthy()
    expect(screen.getByText('已显示全部提交')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '提交 Merge feature' }))
    expect(document.querySelector('[data-git-graph-merge="true"]')?.getAttribute('data-selected')).toBe('true')
    fireEvent.click(screen.getByLabelText('4'))
    expect(screen.getByText('Merge feature')).toBeTruthy()
    const graphHead = screen.getByRole('button', { name: '收起Graph' })
    fireEvent.keyDown(graphHead, { key: 'Escape' })
    expect(screen.getByText('Merge feature')).toBeTruthy()
    fireEvent.keyDown(graphHead, { key: 'Enter' })
    expect(screen.queryByText('Merge feature')).toBeNull()
    fireEvent.keyDown(screen.getByRole('button', { name: '展开Graph' }), { key: ' ' })
    expect(screen.getByText('Merge feature')).toBeTruthy()
  })

  it('graph: clicking a commit loads its files in the preview without hunk actions', async () => {
    const hash = 'm'.repeat(40)
    const gitCommitDiff = vi.fn(async () => ({
      availability: 'repository' as const,
      hash,
      truncated: true,
      files: [
        {
          path: 'src/app.ts',
          status: 'modified' as const,
          preview: TEXT_PREVIEW,
        },
        {
          path: 'pkg/extra.py',
          status: 'added' as const,
          preview: { kind: 'untracked-text' as const, text: 'brand new\n' },
        },
        {
          path: 'gone.bin',
          status: 'deleted' as const,
          preview: { kind: 'deleted-binary' as const },
        },
      ],
    }))
    mount({
      tree: DIRTY_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [
          logEntry({
            hash, shortHash: 'merge01', parents: ['a'.repeat(40), 'b'.repeat(40)],
            subject: 'Merge feature',
          }),
        ],
        hasMore: false,
      })),
      gitCommitDiff,
    })
    await waitFor(() => { expect(screen.getByText('Merge feature')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 Merge feature' }))
    await waitFor(() => { expect(gitCommitDiff).toHaveBeenCalledWith(WID, hash, expect.any(AbortSignal)) })
    await waitFor(() => { expect(screen.getByText('app.ts')).toBeTruthy() })
    const commitGlyph = document.querySelector('[data-commit-file="src/app.ts"] img')
    expect(commitGlyph).toBeTruthy()
    fireEvent.error(commitGlyph!)
    fireEvent.error(commitGlyph!)
    expect(screen.getByText('extra.py')).toBeTruthy()
    expect(screen.getByText('gone.bin')).toBeTruthy()
    expect(screen.getByRole('button', { name: '展开 src/app.ts' })).toBeTruthy()
    expect(screen.queryByText('brand new')).toBeNull()
    expect(screen.queryByText('二进制文件有差异')).toBeNull()
    expect(screen.getByText('仅显示前 3 个文件')).toBeTruthy()
    const preview = screen.getByRole('region', { name: '差异预览' })
    expect(within(preview).queryByRole('button', { name: '选入提交' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 pkg/extra.py' }))
    expect(screen.getByText('brand new')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '展开 gone.bin' }))
    expect(screen.getByText('二进制文件有差异')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '展开 src/app.ts' }))
    expect(screen.getByRole('button', { name: '收起 src/app.ts' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收起 src/app.ts' }))
    expect(screen.getByRole('button', { name: '展开 src/app.ts' })).toBeTruthy()
    expect(screen.getByText('brand new')).toBeTruthy()
    fireEvent.click(screen.getByText('README.md'))
    await waitFor(() => {
      expect(screen.queryByText('选择一个文件或 Graph 中的提交以查看差异')).toBeNull()
      expect(within(screen.getByRole('region', { name: '差异预览' })).queryByRole('button', { name: '选入提交' })).not.toBeNull()
    })
  })

  it('graph: a many-file commit mounts diff rows only after a header expands', async () => {
    const hash = 'n'.repeat(40)
    const files = Array.from({ length: 24 }, (_, index) => ({
      path: `src/f${index}.ts`,
      status: 'modified' as const,
      preview: TEXT_PREVIEW,
    }))
    mount({
      tree: DIRTY_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({ hash, shortHash: 'many01', subject: 'Many files' })],
        hasMore: false,
      })),
      gitCommitDiff: vi.fn(async () => ({
        availability: 'repository' as const,
        hash,
        truncated: false,
        files,
      })),
    })
    await waitFor(() => { expect(screen.getByText('Many files')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 Many files' }))
    await waitFor(() => { expect(screen.getByText('f0.ts')).toBeTruthy() })
    expect(document.querySelectorAll('[data-diff-row]').length).toBe(0)
    expect(screen.getByRole('button', { name: '展开 src/f0.ts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '展开 src/f23.ts' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '展开 src/f0.ts' }))
    expect(document.querySelectorAll('[data-diff-row]').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '展开 src/f1.ts' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收起 src/f0.ts' }))
    expect(document.querySelectorAll('[data-diff-row]').length).toBe(0)
  })

  it('graph: an empty commit shows the empty-commit copy', async () => {
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({ hash: 'e'.repeat(40), shortHash: 'empty01', subject: 'empty' })],
        hasMore: false,
      })),
      gitCommitDiff: vi.fn(async () => ({
        availability: 'repository' as const,
        hash: 'e'.repeat(40),
        files: [],
        truncated: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('empty')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 empty' }))
    await waitFor(() => { expect(screen.getByText('该提交没有文件变更')).toBeTruthy() })
  })

  it('graph: commit diff errors and availability failures surface in the preview', async () => {
    const gitCommitDiff = vi.fn()
      .mockRejectedValueOnce(new DirectoryBrowseError({
        code: 'git-failed', message: 'bad object', details: {},
      }))
      .mockResolvedValueOnce({ availability: 'git-unavailable' as const })
      .mockResolvedValueOnce({ availability: 'not-a-repository' as const })
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [
          logEntry({ hash: 'a'.repeat(40), shortHash: 'aaa', subject: 'one' }),
          logEntry({ hash: 'b'.repeat(40), shortHash: 'bbb', subject: 'two' }),
          logEntry({ hash: 'c'.repeat(40), shortHash: 'ccc', subject: 'three' }),
        ],
        hasMore: false,
      })),
      gitCommitDiff,
    })
    await waitFor(() => { expect(screen.getByText('one')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 one' }))
    await waitFor(() => { expect(screen.getByText('bad object')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 two' }))
    await waitFor(() => { expect(screen.getByText('Git 不可用')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交 three' }))
    await waitFor(() => { expect(screen.getByText('不是 Git 仓库')).toBeTruthy() })
  })

  it('graph: each row hugs its own node or stroke instead of the page-wide max lane', async () => {
    const narrow = GIT_GRAPH_LANE_WIDTH
    const wide = 2 * GIT_GRAPH_LANE_WIDTH
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [
          logEntry({
            hash: 't'.repeat(40), shortHash: 'tip0001', parents: ['m'.repeat(40)],
            subject: 'tip above merge',
          }),
          logEntry({
            hash: 'm'.repeat(40), shortHash: 'merge01', parents: ['a'.repeat(40), 'b'.repeat(40)],
            subject: 'Merge feature',
          }),
          logEntry({
            hash: 'a'.repeat(40), shortHash: 'main001', parents: ['r'.repeat(40)],
            subject: 'main tip',
          }),
          logEntry({
            hash: 'b'.repeat(40), shortHash: 'feat001', parents: ['r'.repeat(40)],
            subject: 'feat: side',
          }),
          logEntry({
            hash: 'r'.repeat(40), shortHash: 'root001',
            subject: 'root',
          }),
        ],
        hasMore: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('tip above merge')).toBeTruthy() })
    const gutters = [...document.querySelectorAll('[data-git-graph-gutter]')] as HTMLElement[]
    expect(gutters.map(el => el.style.width)).toEqual([
      `${String(narrow)}px`,
      `${String(wide)}px`,
      `${String(wide)}px`,
      `${String(wide)}px`,
      `${String(wide)}px`,
    ])
  })

  it('graph: hovering a truncated ref pill opens a commit detail card', async () => {
    const refName = 'origin/issue/54-host-git-rpc-workspace'
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({
          hash: 'm'.repeat(40),
          shortHash: 'merge01',
          subject: 'Merge feature',
          authorName: 'NanGePlus',
          body: '- feat: graph pills\n- hover card',
          refs: [refName],
        })],
        hasMore: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('Merge feature')).toBeTruthy() })
    const pill = document.querySelector(`[data-git-graph-ref="${refName}"]`)
    expect(pill).toBeTruthy()
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.mouseEnter(pill!)
    const card = await waitFor(() => {
      const el = document.querySelector('[data-git-graph-card]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(card.textContent).toContain(refName)
    expect(card.textContent).toContain('NanGePlus')
    expect(card.textContent).toContain('Merge feature')
    expect(card.textContent).toContain('feat: graph pills')
    expect(card.textContent).toContain('merge01')
    expect(card.querySelector('time')?.getAttribute('dateTime')).toBe(LOG_DATE)
  })

  it('graph: ref pills sit on a second line, right of the subject, not beside the author', async () => {
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [
          logEntry({
            hash: 'm'.repeat(40), shortHash: 'merge01', subject: 'Merge feature',
            refs: ['origin/issue/54-host-git-rpc-workspace', 'issue/54-host-git-rpc-workspace'],
          }),
          logEntry({
            hash: 'a'.repeat(40), shortHash: 'main001', subject: 'plain tip',
          }),
        ],
        hasMore: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('Merge feature')).toBeTruthy() })
    const tagged = screen.getByRole('button', { name: '提交 Merge feature' })
    const refs = tagged.querySelector('[data-git-graph-refs]')
    const subject = tagged.querySelector('[class*="graphSubject"]')
    const author = tagged.querySelector('[class*="graphAuthor"]')
    expect(refs).toBeTruthy()
    expect(subject).toBeTruthy()
    expect(author).toBeTruthy()
    expect(tagged.getAttribute('data-git-graph-has-refs')).toBe('true')
    expect(refs!.querySelector('[data-git-graph-ref="origin/issue/54-host-git-rpc-workspace"]')).toBeTruthy()
    expect(refs!.querySelector('[data-git-graph-ref="issue/54-host-git-rpc-workspace"]')).toBeTruthy()
    expect(subject!.compareDocumentPosition(refs!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(author!.compareDocumentPosition(refs!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(subject!.closest('[class*="graphPrimary"]')?.contains(refs)).toBe(false)
    const plain = screen.getByRole('button', { name: '提交 plain tip' })
    expect(plain.querySelector('[data-git-graph-refs]')).toBeNull()
    expect(plain.getAttribute('data-git-graph-has-refs')).toBeNull()
  })

  it('graph: a local ref pill hover card omits empty body and date', async () => {
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({
          hash: 'l'.repeat(40),
          shortHash: 'local01',
          subject: 'local tip',
          authorDate: '',
          body: '   ',
          refs: ['main'],
        })],
        hasMore: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('local tip')).toBeTruthy() })
    fireEvent.mouseEnter(document.querySelector('[data-git-graph-ref="main"]')!)
    const card = await waitFor(() => {
      const el = document.querySelector('[data-git-graph-card]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(card.querySelector('time')).toBeNull()
    expect(card.querySelector('pre')).toBeNull()
    expect(card.textContent).toContain('local01')
  })

  it('graph: leaving a ref pill hides the card after the hover delay', async () => {
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({
          hash: 'm'.repeat(40), shortHash: 'merge01', subject: 'Merge feature',
          refs: ['origin/main'],
        })],
        hasMore: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('Merge feature')).toBeTruthy() })
    vi.useFakeTimers()
    try {
      const pill = document.querySelector('[data-git-graph-ref="origin/main"]')!
      fireEvent.mouseEnter(pill)
      expect(document.querySelector('[data-git-graph-card]')).toBeTruthy()
      fireEvent.mouseLeave(pill)
      act(() => { vi.advanceTimersByTime(119) })
      expect(document.querySelector('[data-git-graph-card]')).toBeTruthy()
      act(() => { vi.advanceTimersByTime(1) })
      expect(document.querySelector('[data-git-graph-card]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('graph: moving onto the card keeps it open, and collapsing Graph closes it', async () => {
    mount({
      tree: CLEAN_REPO,
      gitLog: vi.fn(async () => ({
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [logEntry({
          hash: 'm'.repeat(40), shortHash: 'merge01', subject: 'Merge feature',
          refs: ['origin/main'],
        })],
        hasMore: false,
      })),
    })
    await waitFor(() => { expect(screen.getByText('Merge feature')).toBeTruthy() })
    vi.useFakeTimers()
    try {
      const pill = document.querySelector('[data-git-graph-ref="origin/main"]')!
      fireEvent.mouseEnter(pill)
      const card = document.querySelector('[data-git-graph-card]')!
      fireEvent.mouseLeave(pill)
      fireEvent.mouseEnter(card)
      act(() => { vi.advanceTimersByTime(200) })
      expect(document.querySelector('[data-git-graph-card]')).toBeTruthy()
      fireEvent.mouseLeave(card)
      fireEvent.click(screen.getByRole('button', { name: '收起Graph' }))
      expect(document.querySelector('[data-git-graph-card]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('graph: appends the next page when the sentinel intersects', async () => {
    const page = (hash: string, subject: string): GitLogEntry => (
      logEntry({ hash: hash.repeat(40), shortHash: hash, subject })
    )
    const observed: IntersectionObserverCallback[] = []
    class FakeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observed.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    try {
      const gitLog = vi.fn(async (_workspaceId: WorkspaceId, query?: { limit?: number; skip?: number }) => {
        if ((query?.skip ?? 0) === 0) {
          return {
            availability: 'repository' as const,
            repoRoot: ROOT,
            commits: [page('a', 'newest'), page('b', 'middle')],
            hasMore: true,
          }
        }
        return {
          availability: 'repository' as const,
          repoRoot: ROOT,
          commits: [page('c', 'oldest')],
          hasMore: false,
        }
      })
      mount({ tree: CLEAN_REPO, gitLog })
      await waitFor(() => { expect(screen.getByText('newest')).toBeTruthy() })
      expect(screen.getByText('middle')).toBeTruthy()
      expect(screen.queryByText('oldest')).toBeNull()
      expect(gitLog).toHaveBeenCalledWith(WID, { limit: 50 }, expect.any(AbortSignal))
      expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy()
      await waitFor(() => { expect(observed.length).toBeGreaterThan(0) })
      act(() => {
        observed[0]?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
      })
      expect(screen.queryByText('oldest')).toBeNull()
      act(() => {
        observed[0]?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      })
      await waitFor(() => { expect(screen.getByText('oldest')).toBeTruthy() })
      expect(gitLog).toHaveBeenCalledWith(WID, { limit: 50, skip: 2 }, expect.any(AbortSignal))
      expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('graph: load-more button appends the next page', async () => {
    const page = (hash: string, subject: string): GitLogEntry => (
      logEntry({ hash: hash.repeat(40), shortHash: hash, subject })
    )
    const gitLog = vi.fn(async (_workspaceId: WorkspaceId, query?: { limit?: number; skip?: number }) => {
      if ((query?.skip ?? 0) === 0) {
        return {
          availability: 'repository' as const,
          repoRoot: ROOT,
          commits: [page('d', 'tip')],
          hasMore: true,
        }
      }
      return {
        availability: 'repository' as const,
        repoRoot: ROOT,
        commits: [page('e', 'older')],
        hasMore: false,
      }
    })
    mount({ tree: CLEAN_REPO, gitLog })
    await waitFor(() => { expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))
    await waitFor(() => { expect(screen.getByText('older')).toBeTruthy() })
    expect(gitLog).toHaveBeenCalledTimes(2)
    expect(gitLog).toHaveBeenCalledWith(WID, { limit: 50, skip: 1 }, expect.any(AbortSignal))
  })

  it('graph: a failed extra page keeps the load-more control', async () => {
    const page = (hash: string, subject: string): GitLogEntry => (
      logEntry({ hash: hash.repeat(40), shortHash: hash, subject })
    )
    const gitLog = vi.fn(async (_workspaceId: WorkspaceId, query?: { limit?: number; skip?: number }) => {
      if ((query?.skip ?? 0) === 0) {
        return {
          availability: 'repository' as const,
          repoRoot: ROOT,
          commits: [page('f', 'only')],
          hasMore: true,
        }
      }
      throw new Error('log failed')
    })
    mount({ tree: CLEAN_REPO, gitLog })
    await waitFor(() => { expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))
    await waitFor(() => { expect(gitLog).toHaveBeenCalledTimes(2) })
    expect(screen.getByText('only')).toBeTruthy()
    expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy()
  })

  it('graph: a non-repository extra page stops paging', async () => {
    const page = (hash: string, subject: string): GitLogEntry => (
      logEntry({ hash: hash.repeat(40), shortHash: hash, subject })
    )
    const gitLog = vi.fn(async (_workspaceId: WorkspaceId, query?: { limit?: number; skip?: number }) => {
      if ((query?.skip ?? 0) === 0) {
        return {
          availability: 'repository' as const,
          repoRoot: ROOT,
          commits: [page('g', 'tip')],
          hasMore: true,
        }
      }
      return { availability: 'not-a-repository' as const }
    })
    mount({ tree: CLEAN_REPO, gitLog })
    await waitFor(() => { expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))
    await waitFor(() => { expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull() })
    expect(screen.getByText('tip')).toBeTruthy()
  })

  it('graph: overlapping extra-page hashes stop paging', async () => {
    const tip: GitLogEntry = logEntry({
      hash: 'h'.repeat(40), shortHash: 'h', subject: 'same',
    })
    const gitLog = vi.fn(async () => ({
      availability: 'repository' as const,
      repoRoot: ROOT,
      commits: [tip],
      hasMore: true,
    }))
    mount({ tree: CLEAN_REPO, gitLog })
    await waitFor(() => { expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))
    await waitFor(() => { expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull() })
    expect(screen.getByText('same')).toBeTruthy()
  })

  it('graph: collapsing the section while more pages exist hides the sentinel', async () => {
    const gitLog = vi.fn(async () => ({
      availability: 'repository' as const,
      repoRoot: ROOT,
      commits: [logEntry({
        hash: 'i'.repeat(40), shortHash: 'i', subject: 'open',
      })],
      hasMore: true,
    }))
    mount({ tree: CLEAN_REPO, gitLog })
    await waitFor(() => { expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '收起Graph' }))
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull()
  })

  it('default: binds the Session Workspace, lists both sides, and shows a detached HEAD', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getAllByText('a.ts').length).toBe(2) })
    expect(b.gitWorkingTree).toHaveBeenCalledWith(WID, expect.any(AbortSignal))
    expect(screen.getByText('提交到分支 HEAD detached at abc1234')).toBeTruthy()
    expect(screen.getByRole('button', { name: '收起Changes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '收起Graph' })).toBeTruthy()
    expect(screen.getByText('已更改，暂未选入提交')).toBeTruthy()
    expect(screen.getByText('待提交')).toBeTruthy()
    expect(screen.getAllByText('a.ts')).toHaveLength(2)
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.getByText('note.md')).toBeTruthy()
    expect(screen.getByText('docs')).toBeTruthy()
    expect(screen.queryByText('node_modules/pkg.js')).toBeNull()
    expect(screen.getByText('选择一个文件或 Graph 中的提交以查看差异')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: '初始化仓库' })).toBeNull()
  })

  it('shows per-section file counts and collapses change lists from the header', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const unstagedHead = screen.getByRole('button', { name: '收起已更改，暂未选入提交' })
    const stagedHead = screen.getByRole('button', { name: '收起待提交' })
    expect(within(unstagedHead).getByLabelText('2 个文件')).toBeTruthy()
    expect(within(stagedHead).getByLabelText('2 个文件')).toBeTruthy()
    fireEvent.click(unstagedHead)
    expect(screen.queryByText('README.md')).toBeNull()
    expect(screen.getByText('note.md')).toBeTruthy()
    expect(screen.getByRole('button', { name: '展开已更改，暂未选入提交' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '展开已更改，暂未选入提交' }))
    expect(screen.getByText('README.md')).toBeTruthy()
  })

  it('collapses Changes without hiding Graph, and restores the working-tree chrome', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const changesHead = screen.getByRole('button', { name: '收起Changes' })
    fireEvent.keyDown(changesHead, { key: 'Escape' })
    expect(screen.getByText('提交到分支 HEAD detached at abc1234')).toBeTruthy()
    fireEvent.keyDown(changesHead, { key: 'Enter' })
    expect(screen.queryByText('提交到分支 HEAD detached at abc1234')).toBeNull()
    expect(screen.queryByPlaceholderText('请填写提交备注信息')).toBeNull()
    expect(screen.queryByText('已更改，暂未选入提交')).toBeNull()
    expect(screen.queryByText('待提交')).toBeNull()
    expect(screen.getByRole('button', { name: '收起Graph' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('button', { name: '展开Changes' }), { key: ' ' })
    expect(screen.getByText('提交到分支 HEAD detached at abc1234')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收起Changes' }))
    expect(screen.queryByText('README.md')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开Changes' }))
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.getByRole('button', { name: '提交' })).toBeTruthy()
  })

  it('renders folder chrome: uppercase titles, indented lists, Graph pinned while Changes is open', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(document.getElementById('git-section-changes-title')).toBeTruthy()
    expect(document.getElementById('git-section-graph-title')).toBeTruthy()
    expect(document.querySelector('[data-git-lists]')).toBeTruthy()
    expect(document.querySelector('[data-git-graph]')).toBeTruthy()
    expect(document.querySelector('[data-git-changes-files]')).toBeTruthy()
    expect(document.querySelector('[data-git-changes]')?.getAttribute('data-collapsed')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '收起Changes' }))
    expect(document.querySelector('[data-git-changes]')?.getAttribute('data-collapsed')).toBe('true')
    expect(screen.getByRole('button', { name: '收起Graph' })).toBeTruthy()
  })

  it('shows the unstaged plus staged row count on the CHANGES folder head', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const count = document.querySelector('[data-git-changes-count]')
    expect(count?.textContent).toBe(String(DIRTY_REPO.unstaged.length + DIRTY_REPO.staged.length))
    expect(count?.getAttribute('aria-label')).toBe(String(DIRTY_REPO.unstaged.length + DIRTY_REPO.staged.length))
    fireEvent.click(screen.getByRole('button', { name: '收起Changes' }))
    expect(document.querySelector('[data-git-changes-count]')?.textContent)
      .toBe(String(DIRTY_REPO.unstaged.length + DIRTY_REPO.staged.length))
  })

  it('shows zero on the CHANGES folder head when the working tree is clean', async () => {
    mount({ tree: CLEAN_REPO })
    await waitFor(() => { expect(document.getElementById('git-section-changes-title')).toBeTruthy() })
    expect(document.querySelector('[data-git-changes-count]')?.textContent).toBe('0')
  })

  it('does not toggle section collapse when clicking the bulk stage control', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByRole('button', { name: '全部选入' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部选入' }))
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.getByRole('button', { name: '收起已更改，暂未选入提交' })).toBeTruthy()
  })

  it('does not poll while remaining on the Git tab', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(b.gitWorkingTree).toHaveBeenCalledTimes(1)
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30) }) })
    expect(b.gitWorkingTree).toHaveBeenCalledTimes(1)
  })

  it('re-reads disk when the Git tab becomes visible again', async () => {
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce(DIRTY_REPO)
      .mockReturnValueOnce(new Promise(() => {}))
      .mockReturnValueOnce(new Promise(() => {}))
    const b = mount({ gitWorkingTree })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    expect(screen.getByText('README.md')).toBeTruthy()
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => {
      expect(gitWorkingTree).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('progressbar', { name: '刷新 Git 状态' })).toBeTruthy()
    })
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.queryByText('加载中…')).toBeNull()
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(gitWorkingTree).toHaveBeenCalledTimes(3) })
    expect(screen.getByRole('progressbar', { name: '刷新 Git 状态' })).toBeTruthy()
  })

  it('follows the current Session Workspace after a Session switch', async () => {
    const other = workspace({
      workspaceId: WID2,
      path: '/w/beta',
      title: 'beta',
      sessionIds: [SID2],
    })
    const gitWorkingTree = vi.fn(async (workspaceId: WorkspaceId) => {
      if (workspaceId === WID2) {
        return {
          availability: 'repository' as const,
          repoRoot: '/repos/beta',
          branch: 'topic',
          unstaged: [change('beta.ts', 'modified', '/repos/beta')],
          staged: [],
          pushAvailable: false,
        }
      }
      return DIRTY_REPO
    })
    const b = mount({ gitWorkingTree, items: [workspace(), other] })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    act(() => {
      b.sessionsStore.update((draft) => { draft.current = SID2 })
    })
    b.view.rerender(<GitPanel {...b.props} />)
    await waitFor(() => { expect(screen.getByText('beta.ts')).toBeTruthy() })
    expect(screen.getByText('提交到分支 topic')).toBeTruthy()
    expect(screen.queryByText('README.md')).toBeNull()
    expect(gitWorkingTree).toHaveBeenLastCalledWith(WID2, expect.any(AbortSignal))
  })

  it('does not fetch a Session switch while the Git tab is hidden', async () => {
    const other = workspace({
      workspaceId: WID2,
      path: '/w/beta',
      title: 'beta',
      sessionIds: [SID2],
    })
    const b = mount({ visible: false, items: [workspace(), other] })
    act(() => {
      b.sessionsStore.update((draft) => { draft.current = SID2 })
    })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    await act(async () => { await Promise.resolve() })
    expect(b.gitWorkingTree).not.toHaveBeenCalled()
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(b.gitWorkingTree).toHaveBeenCalledWith(WID2, expect.any(AbortSignal)) })
  })

  it('lists only the disk working tree returned by the Host', async () => {
    mount({
      tree: {
        availability: 'repository',
        repoRoot: '/repos/app',
        branch: 'main',
        unstaged: [change('saved.ts', 'modified')],
        staged: [],
        pushAvailable: false,
      },
    })
    await waitFor(() => { expect(screen.getByText('saved.ts')).toBeTruthy() })
    expect(screen.queryByText('unsaved-buffer.ts')).toBeNull()
  })

  it('shows a Host failure instead of spinning forever', async () => {
    mount({
      gitWorkingTree: vi.fn(async () => {
        throw new DirectoryBrowseError({ code: 'internal', message: 'status exploded', details: {} })
      }),
    })
    await waitFor(() => { expect(screen.getByText('status exploded')).toBeTruthy() })
    expect(screen.queryByText('加载中…')).toBeNull()
  })

  it('shows a generic working-tree failure message', async () => {
    mount({
      gitWorkingTree: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    await waitFor(() => { expect(screen.getByText('boom')).toBeTruthy() })
  })

  it('stringifies a non-Error working-tree rejection', async () => {
    mount({
      gitWorkingTree: vi.fn(async () => {
        throw 'status exploded'
      }),
    })
    await waitFor(() => { expect(screen.getByText('status exploded')).toBeTruthy() })
  })

  it('does not fetch without a bound Workspace', async () => {
    const b = mount({ items: [] })
    await act(async () => { await Promise.resolve() })
    expect(b.gitWorkingTree).not.toHaveBeenCalled()
    expect(screen.queryByText('加载中…')).toBeNull()
  })

  it('does not fetch without a current Session', async () => {
    const b = mount({ noCurrentSession: true, items: [workspace()] })
    await act(async () => { await Promise.resolve() })
    expect(b.gitWorkingTree).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText('请填写提交备注信息')).toBeNull()
  })

  it('drops a working-tree result that arrives after the read is aborted', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const pending = new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve })
    const b = mount({ gitWorkingTree: vi.fn(() => pending) })
    expect(screen.getByText('加载中…')).toBeTruthy()
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    await act(async () => { settle(DIRTY_REPO) })
    expect(screen.queryByText('README.md')).toBeNull()
  })

  it('ignores an AbortError from a superseded working-tree read', async () => {
    let rejectRead!: (error: Error) => void
    const gitWorkingTree = vi.fn(() => new Promise<GitWorkingTreeResult>((_resolve, reject) => {
      rejectRead = reject
    }))
    mount({ gitWorkingTree })
    expect(screen.getByText('加载中…')).toBeTruthy()
    await act(async () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      rejectRead(error)
    })
    expect(screen.queryByText('aborted')).toBeNull()
    expect(screen.getByText('加载中…')).toBeTruthy()
  })

  it('drops a non-abort rejection that arrives after the read is aborted', async () => {
    const gitWorkingTree = vi.fn((_id: WorkspaceId, signal?: AbortSignal) => {
      return new Promise<GitWorkingTreeResult>((_resolve, reject) => {
        signal?.addEventListener('abort', () => { reject(new Error('late failure')) })
      })
    })
    const b = mount({ gitWorkingTree })
    expect(screen.getByText('加载中…')).toBeTruthy()
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText('late failure')).toBeNull()
  })

  it('ignores a second initialize click while one is in flight', async () => {
    let settle!: () => void
    const gitInit = vi.fn(() => new Promise<{ repoRoot: string }>((resolve) => {
      settle = () => { resolve({ repoRoot: ROOT }) }
    }))
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce({ availability: 'not-a-repository' })
      .mockResolvedValueOnce(CLEAN_REPO)
    mount({ gitWorkingTree, gitInit })
    await waitFor(() => { expect(screen.getByRole('button', { name: '初始化仓库' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '初始化仓库' }))
    fireEvent.click(screen.getByRole('button', { name: '初始化仓库' }))
    expect(gitInit).toHaveBeenCalledTimes(1)
    await act(async () => { settle() })
    await waitFor(() => { expect(screen.getByText('提交到分支 main')).toBeTruthy() })
  })

  it('falls back to the generic file glyph when a type icon fails to load', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    const glyph = screen.getAllByRole('img', { name: '文件' })[0]!.querySelector('img')
    expect(glyph).toBeTruthy()
    fireEvent.error(glyph!)
    expect(glyph!.getAttribute('src')?.endsWith('/material-icons/file.svg')).toBe(true)
    fireEvent.error(glyph!)
    expect(glyph!.getAttribute('src')?.endsWith('/material-icons/file.svg')).toBe(true)
  })

  function rowOf(path: string, index = 0): HTMLElement {
    return screen.getAllByRole('listitem')
      .filter(el => el.getAttribute('data-change-path') === path)[index]!
  }

  function previewPane(): HTMLElement {
    return screen.getByRole('region', { name: '差异预览' })
  }

  it('default: unstaged rows keep stage and discard actions in the row; staged rows only unstage', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(within(rowOf('README.md')).getByRole('button', { name: '选入提交' })).toBeTruthy()
    expect(within(rowOf('README.md')).getByRole('button', { name: '撤销更改' })).toBeTruthy()
    expect(within(rowOf('docs/note.md')).getByRole('button', { name: '移出提交' })).toBeTruthy()
    expect(within(rowOf('docs/note.md')).queryByRole('button', { name: '撤销更改' })).toBeNull()
    expect(screen.getByRole('button', { name: '全部选入' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '全部移出' })).toBeTruthy()
  })

  it('shows a hover tooltip on row icon actions', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    vi.useFakeTimers()
    try {
      fireEvent.mouseEnter(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }))
      act(() => { vi.advanceTimersByTime(500) })
      expect(screen.getByRole('tooltip').textContent).toBe('选入提交')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stages one unstaged file into the staged list', async () => {
    const staged = {
      ...DIRTY_REPO,
      unstaged: [change('src/a.ts', 'modified')],
      staged: [
        change('src/a.ts', 'modified'),
        change('docs/note.md', 'modified'),
        change('README.md', 'modified'),
      ],
    }
    const gitStage = vi.fn(async () => staged)
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }))
    await waitFor(() => {
      expect(gitStage).toHaveBeenCalledWith(WID, '/repos/app/README.md')
    })
    await waitFor(() => {
      expect(within(rowOf('README.md')).queryByRole('button', { name: '选入提交' })).toBeNull()
      expect(within(rowOf('README.md')).getByRole('button', { name: '移出提交' })).toBeTruthy()
    })
  })

  it('unstages one staged file without calling discard', async () => {
    const unstaged = {
      ...DIRTY_REPO,
      unstaged: [
        change('src/a.ts', 'modified'),
        change('README.md', 'modified'),
        change('docs/note.md', 'modified'),
      ],
      staged: [change('src/a.ts', 'modified')],
    }
    const gitUnstage = vi.fn(async () => unstaged)
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitUnstage, gitDiscard })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('docs/note.md')).getByRole('button', { name: '移出提交' }))
    await waitFor(() => {
      expect(gitUnstage).toHaveBeenCalledWith(WID, '/repos/app/docs/note.md')
    })
    expect(gitDiscard).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(within(rowOf('docs/note.md')).getByRole('button', { name: '选入提交' })).toBeTruthy()
    })
  })

  it('stages every unstaged path from the section action', async () => {
    const gitStage = vi.fn(async (workspaceId: WorkspaceId, path: string) => {
      void workspaceId
      if (path.endsWith('README.md')) {
        return {
          ...DIRTY_REPO,
          unstaged: [change('src/a.ts', 'modified')],
          staged: [
            ...DIRTY_REPO.staged,
            change('README.md', 'modified'),
          ],
        }
      }
      return {
        ...DIRTY_REPO,
        unstaged: [],
        staged: [
          change('src/a.ts', 'modified'),
          change('docs/note.md', 'modified'),
          change('README.md', 'modified'),
        ],
      }
    })
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => { expect(screen.getByRole('button', { name: '全部选入' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部选入' }))
    await waitFor(() => { expect(gitStage).toHaveBeenCalledTimes(2) })
    expect(gitStage.mock.calls.map(call => call[1])).toEqual([
      '/repos/app/src/a.ts',
      '/repos/app/README.md',
    ])
  })

  it('unstages every staged path from the section action', async () => {
    const gitUnstage = vi.fn(async (_workspaceId: WorkspaceId, _path: string) => ({
      ...DIRTY_REPO,
      unstaged: [
        change('src/a.ts', 'modified'),
        change('README.md', 'modified'),
        change('docs/note.md', 'modified'),
      ],
      staged: [],
    }))
    mount({ tree: DIRTY_REPO, gitUnstage })
    await waitFor(() => { expect(screen.getByRole('button', { name: '全部移出' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部移出' }))
    await waitFor(() => { expect(gitUnstage).toHaveBeenCalledTimes(2) })
    expect(gitUnstage.mock.calls.map(call => call[1])).toEqual([
      '/repos/app/src/a.ts',
      '/repos/app/docs/note.md',
    ])
  })

  it('row-busy: shows a 16px spinner on the row while staging', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitStage = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }))
    await waitFor(() => {
      expect(within(rowOf('README.md')).getByRole('status', { name: '正在选入…' })).toBeTruthy()
    })
    await act(async () => { settle(DIRTY_REPO) })
  })

  it('path-write-in-progress: keeps 提交 enabled while staging so the primary button does not flash', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitStage = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
    })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }))
    await waitFor(() => {
      expect(within(rowOf('README.md')).getByRole('status', { name: '正在选入…' })).toBeTruthy()
    })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
    await act(async () => { settle(DIRTY_REPO) })
  })

  it('path-write-in-progress: keeps 提交 enabled while unstaging', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitUnstage = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitUnstage })
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
    })
    fireEvent.click(within(rowOf('docs/note.md')).getByRole('button', { name: '移出提交' }))
    await waitFor(() => { expect(gitUnstage).toHaveBeenCalled() })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
    await act(async () => { settle(DIRTY_REPO) })
  })

  it('path-write-in-progress: keeps 提交 enabled while discarding', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitDiscard = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitDiscard })
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
    })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '撤销更改' }))
    fireEvent.click(screen.getByRole('button', { name: '确认撤销' }))
    await waitFor(() => { expect(gitDiscard).toHaveBeenCalled() })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
    await act(async () => { settle(DIRTY_REPO) })
  })

  it('discard-confirm: tracked modification copy, cancel does not call Host', async () => {
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DISCARD_REPO, gitDiscard })
    await waitFor(() => { expect(screen.getByText('tracked.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('tracked.ts')).getByRole('button', { name: '撤销更改' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '撤销更改' }))
    expect(within(dialog).getByText(/tracked\.ts/)).toBeTruthy()
    expect(within(dialog).getByText('将把磁盘内容恢复为待提交区或 HEAD')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(gitDiscard).not.toHaveBeenCalled()
  })

  it('discard-confirm: untracked copy and confirmed discard deletes from disk via Host', async () => {
    const gitDiscard = vi.fn(async () => ({
      ...DISCARD_REPO,
      unstaged: [
        change('tracked.ts', 'modified'),
        change('gone.ts', 'deleted'),
      ],
    }))
    mount({ tree: DISCARD_REPO, gitDiscard })
    await waitFor(() => { expect(screen.getByText('new.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('new.ts')).getByRole('button', { name: '撤销更改' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '删除未跟踪文件' }))
    expect(within(dialog).getByText('将从磁盘删除该路径')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '删除文件' }))
    await waitFor(() => {
      expect(gitDiscard).toHaveBeenCalledWith(WID, '/repos/app/new.ts')
    })
    await waitFor(() => { expect(screen.queryByText('new.ts')).toBeNull() })
  })

  it('discard-confirm: tracked deletion restores the file to disk', async () => {
    const gitDiscard = vi.fn(async () => ({
      ...DISCARD_REPO,
      unstaged: [
        change('tracked.ts', 'modified'),
        change('new.ts', 'untracked'),
      ],
    }))
    mount({ tree: DISCARD_REPO, gitDiscard })
    await waitFor(() => { expect(screen.getByText('gone.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('gone.ts')).getByRole('button', { name: '撤销更改' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '撤销更改' }))
    expect(within(dialog).getByText('将把文件恢复到磁盘')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销' }))
    await waitFor(() => {
      expect(gitDiscard).toHaveBeenCalledWith(WID, '/repos/app/gone.ts')
    })
  })

  it('discard-confirm: notifies the Explorer occupant when discard changes disk', async () => {
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    const notifyDiskPathsChanged = vi.fn()
    mount({ tree: DISCARD_REPO, gitDiscard, notifyDiskPathsChanged })
    await waitFor(() => { expect(screen.getByText('tracked.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('tracked.ts')).getByRole('button', { name: '撤销更改' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: '撤销更改' })).getByRole('button', { name: '确认撤销' }))
    await waitFor(() => {
      expect(gitDiscard).toHaveBeenCalledWith(WID, '/repos/app/tracked.ts')
    })
    expect(notifyDiskPathsChanged).toHaveBeenCalledWith(['/repos/app/tracked.ts'], false)
    expect(notifyDiskPathsChanged).toHaveBeenCalledWith(['/repos/app/tracked.ts'], true)
  })

  it('commit-validation: empty message shows an inline hint and does not call Host', async () => {
    const gitCommit = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    const hint = await screen.findByText('请填写提交备注信息后再提交')
    expect(hint.getAttribute('role')).toBe('status')
    expect(gitCommit).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'ship it' } })
    expect(screen.queryByText('请填写提交备注信息后再提交')).toBeNull()
  })

  it('commit-confirm: cancel does not call Host', async () => {
    const gitCommit = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'ship it' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    const dialog = await screen.findByRole('dialog', { name: '确认提交' })
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(gitCommit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '确认提交' })).toBeNull()
  })

  it('commit-confirm: popover sits at the submit button bottom-right', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'ship it' } })
    const submit = screen.getByRole('button', { name: '提交' })
    mockAnchorRect(submit, 160, 108)
    fireEvent.click(submit)
    const dialog = await screen.findByRole('dialog', { name: '确认提交' })
    expect(dialog.style.left).toBe(`${160 + CONFIRM_POPOVER_GAP}px`)
    expect(dialog.style.top).toBe(`${108 + CONFIRM_POPOVER_GAP}px`)
    fireEvent(window, new Event('resize'))
    fireEvent(window, new Event('scroll'))
    expect(dialog.style.left).toBe(`${160 + CONFIRM_POPOVER_GAP}px`)
  })

  it('push-confirm: popover sits at the push button bottom-right', async () => {
    mount({ tree: AHEAD_REPO })
    await waitFor(() => { expect(screen.getByRole('button', { name: '推送' })).toBeTruthy() })
    const push = screen.getByRole('button', { name: '推送' })
    mockAnchorRect(push, 90, 40)
    fireEvent.click(push)
    const dialog = await screen.findByRole('dialog', { name: '确认推送' })
    expect(dialog.style.left).toBe(`${90 + CONFIRM_POPOVER_GAP}px`)
    expect(dialog.style.top).toBe(`${40 + CONFIRM_POPOVER_GAP}px`)
  })

  it('push-confirm: cancel does not call Host', async () => {
    const gitPush = vi.fn(async () => CLEAN_REPO)
    mount({ tree: AHEAD_REPO, gitPush })
    await waitFor(() => { expect(screen.getByRole('button', { name: '推送' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '推送' }))
    const dialog = await screen.findByRole('dialog', { name: '确认推送' })
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(gitPush).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '确认推送' })).toBeNull()
  })

  it('commit-disabled: empty staged keeps 提交 disabled', async () => {
    mount({ tree: CLEAN_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
  })

  it('commit-disabled: a clean staged list stays disabled after typing a message', async () => {
    mount({ tree: CLEAN_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'nothing staged' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
  })

  it('commit-enabled: staged changes keep 提交 enabled before a message is entered', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
  })

  it('commit-in-progress: disables the submit button and shows input border loading', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitCommit = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'wip' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    confirmCommit()
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
      const input = screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement
      expect(input.disabled).toBe(true)
      expect(input.getAttribute('aria-busy')).toBe('true')
      expect(input.closest('[data-pending="true"]')).toBeTruthy()
      expect(screen.queryByText('提交成功')).toBeNull()
    })
    await act(async () => { settle(CLEAN_REPO) })
  })

  it('commit-in-progress: still allows staging another file', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitCommit = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    const gitStage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit, gitStage })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'wip' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    confirmCommit()
    await waitFor(() => {
      const input = screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement
      expect(input.getAttribute('aria-busy')).toBe('true')
    })
    fireEvent.click(screen.getAllByRole('button', { name: '选入提交' })[0]!)
    await waitFor(() => { expect(gitStage).toHaveBeenCalled() })
    await act(async () => { settle(CLEAN_REPO) })
  })

  it('commit-and-push-in-progress: shows input border loading until Host returns', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitCommit = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'wip' } })
    fireEvent.click(screen.getByRole('button', { name: '更多提交选项' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '提交并推送' }))
    confirmCommitPush()
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
      const input = screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement
      expect(input.getAttribute('aria-busy')).toBe('true')
      expect(input.closest('[data-pending="true"]')).toBeTruthy()
      expect(screen.queryByText('提交并推送成功')).toBeNull()
    })
    await act(async () => { settle(CLEAN_REPO) })
  })

  it('commits the current index and clears this Session draft', async () => {
    const gitCommit = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    const input = screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'ship it' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    confirmCommit()
    await waitFor(() => {
      expect(gitCommit).toHaveBeenCalledWith(WID, 'ship it', undefined)
    })
    await waitFor(() => {
      expect((screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement).value).toBe('')
    })
  })

  it('commits with push when choosing 提交并推送 from the menu', async () => {
    const gitCommit = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'push me' } })
    fireEvent.click(screen.getByRole('button', { name: '更多提交选项' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '提交并推送' }))
    confirmCommitPush()
    await waitFor(() => {
      expect(gitCommit).toHaveBeenCalledWith(WID, 'push me', true)
    })
  })

  it('shows a success hint after commit', async () => {
    const gitCommit = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'ship it' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    confirmCommit()
    await waitFor(() => { expect(screen.getByText('提交成功')).toBeTruthy() })
  })

  it('shows a pushed success hint after commit and push', async () => {
    const gitCommit = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'push me' } })
    fireEvent.click(screen.getByRole('button', { name: '更多提交选项' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '提交并推送' }))
    confirmCommitPush()
    await waitFor(() => { expect(screen.getByText('提交并推送成功')).toBeTruthy() })
  })

  it('shows unpushed copy and a push button on a row below the branch', async () => {
    mount({ tree: AHEAD_REPO })
    await waitFor(() => { expect(screen.getByText('提交到分支 main')).toBeTruthy() })
    const pushRow = screen.getByText('有 2 个提交尚未推送').closest('[data-git-push-row]')
    expect(pushRow).toBeTruthy()
    expect(within(pushRow as HTMLElement).getByRole('button', { name: '推送' })).toBeTruthy()
    expect(screen.getByText('提交到分支 main').closest('[data-git-push-row]')).toBeNull()
  })

  it('shows unpublished copy and a push button when the branch has never been pushed', async () => {
    mount({ tree: UNPUBLISHED_REPO })
    await waitFor(() => { expect(screen.getByText('尚未推送到远程')).toBeTruthy() })
    const pushRow = screen.getByText('尚未推送到远程').closest('[data-git-push-row]')
    expect(pushRow).toBeTruthy()
    expect(within(pushRow as HTMLElement).getByRole('button', { name: '推送' })).toBeTruthy()
    fireEvent.click(within(pushRow as HTMLElement).getByRole('button', { name: '推送' }))
    expect(await screen.findByText('将把本地 commit 推送到远程分支 main。')).toBeTruthy()
  })

  it('pushes unpublished commits without staging new changes', async () => {
    const gitPush = vi.fn(async () => CLEAN_REPO)
    mount({ tree: AHEAD_REPO, gitPush })
    await waitFor(() => { expect(screen.getByRole('button', { name: '推送' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '推送' }))
    confirmPush()
    await waitFor(() => { expect(gitPush).toHaveBeenCalledWith(WID) })
    await waitFor(() => { expect(screen.getByText('推送成功')).toBeTruthy() })
  })

  it('push-in-progress: shows border loading around the push button', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitPush = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: AHEAD_REPO, gitPush })
    await waitFor(() => { expect(screen.getByRole('button', { name: '推送' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '推送' }))
    confirmPush()
    await waitFor(() => {
      const btn = screen.getByRole<HTMLButtonElement>('button', { name: '推送' })
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('aria-busy')).toBe('true')
      expect(btn.closest('[data-pending="true"]')).toBeTruthy()
      expect(btn.textContent).toBe('推送')
    })
    await act(async () => { settle(CLEAN_REPO) })
  })

  it('commit-error: shows Git text plus 重试 and keeps the draft', async () => {
    const gitCommit = vi.fn()
      .mockRejectedValueOnce(new DirectoryBrowseError({
        code: 'git-failed',
        message: 'Author identity unknown',
        details: {},
      }))
      .mockResolvedValueOnce(CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'identity' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    confirmCommit()
    await waitFor(() => { expect(screen.getByText('Author identity unknown')).toBeTruthy() })
    expect(screen.queryByLabelText('user.name')).toBeNull()
    expect(screen.queryByLabelText('user.email')).toBeNull()
    expect((screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement).value).toBe('identity')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => { expect(gitCommit).toHaveBeenCalledTimes(2) })
    await waitFor(() => {
      expect((screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement).value).toBe('')
    })
  })

  it('maps a missing-remote commit-and-push failure to 没有配置远程仓库地址', async () => {
    const gitCommit = vi.fn().mockRejectedValue(new DirectoryBrowseError({
      code: 'git-failed',
      message: 'fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add origin <URL>\n',
      details: {},
    }))
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'ship' } })
    fireEvent.click(screen.getByRole('button', { name: '更多提交选项' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '提交并推送' }))
    confirmCommitPush()
    await waitFor(() => { expect(screen.getByText('没有配置远程仓库地址')).toBeTruthy() })
    expect(screen.queryByText(/fatal: No config/)).toBeNull()
    expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
  })

  it('maps a missing-remote standalone push failure to 没有配置远程仓库地址', async () => {
    const gitPush = vi.fn().mockRejectedValue(new DirectoryBrowseError({
      code: 'git-failed',
      message: 'no remote configured',
      details: {},
    }))
    mount({ tree: AHEAD_REPO, gitPush })
    await waitFor(() => { expect(screen.getByRole('button', { name: '推送' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '推送' }))
    confirmPush()
    await waitFor(() => { expect(screen.getByText('没有配置远程仓库地址')).toBeTruthy() })
    expect(screen.queryByText('no remote configured')).toBeNull()
    expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy()
  })

  it('maps a non-fast-forward standalone push failure to 远程已有提交，无法快进推送', async () => {
    const gitPush = vi.fn().mockRejectedValue(new DirectoryBrowseError({
      code: 'git-failed',
      message: 'To https://github.com/NanGePlus/test.git\n ! [rejected]        HEAD -> main (fetch first)\nerror: failed to push some refs to \'https://github.com/NanGePlus/test.git\'\n',
      details: {},
    }))
    mount({ tree: AHEAD_REPO, gitPush })
    await waitFor(() => { expect(screen.getByRole('button', { name: '推送' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '推送' }))
    confirmPush()
    await waitFor(() => { expect(screen.getByText('远程已有提交，无法快进推送')).toBeTruthy() })
    expect(screen.queryByText(/To https:\/\/github.com/)).toBeNull()
  })

  it('shows an add-remote entry when the repository has no remotes', async () => {
    mount({ tree: NO_REMOTE_REPO })
    await waitFor(() => { expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy() })
    expect(screen.getByText('没有配置远程仓库地址')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '推送' })).toBeNull()
  })

  it('adds origin from the no-remote entry and hides the entry', async () => {
    const gitAddRemote = vi.fn(async () => ({
      ...NO_REMOTE_REPO,
      hasRemote: true,
      originUrl: 'https://github.com/org/repo.git',
      pushAvailable: true,
    }))
    mount({ tree: NO_REMOTE_REPO, gitAddRemote })
    await waitFor(() => { expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '添加远程地址' }))
    fireEvent.change(screen.getByPlaceholderText('https://github.com/org/repo.git'), {
      target: { value: 'https://github.com/org/repo.git' },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    await waitFor(() => {
      expect(gitAddRemote).toHaveBeenCalledWith(WID, 'https://github.com/org/repo.git')
    })
    await waitFor(() => { expect(screen.queryByRole('button', { name: '添加远程地址' })).toBeNull() })
    expect(screen.getByRole('button', { name: '删除远程地址' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '推送' })).toBeTruthy()
  })

  it('does not call Host when the remote URL is blank', async () => {
    const gitAddRemote = vi.fn(async () => CLEAN_REPO)
    mount({ tree: NO_REMOTE_REPO, gitAddRemote })
    await waitFor(() => { expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '添加远程地址' }))
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    expect(gitAddRemote).not.toHaveBeenCalled()
    expect(screen.getByText('请填写远程仓库地址')).toBeTruthy()
  })

  it('cancels the add-remote editor without calling Host', async () => {
    const gitAddRemote = vi.fn(async () => CLEAN_REPO)
    mount({ tree: NO_REMOTE_REPO, gitAddRemote })
    await waitFor(() => { expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '添加远程地址' }))
    fireEvent.change(screen.getByPlaceholderText('https://github.com/org/repo.git'), {
      target: { value: 'https://example.com/repo.git' },
    })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(gitAddRemote).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy()
    expect(screen.queryByPlaceholderText('https://github.com/org/repo.git')).toBeNull()
  })

  it('maps Host add-remote failures onto the form', async () => {
    const gitAddRemote = vi.fn()
      .mockRejectedValueOnce(new DirectoryBrowseError({
        code: 'git-failed',
        message: 'empty remote url',
        details: {},
      }))
      .mockRejectedValueOnce(new DirectoryBrowseError({
        code: 'git-failed',
        message: 'fatal: remote origin already exists.',
        details: {},
      }))
    mount({ tree: NO_REMOTE_REPO, gitAddRemote })
    await waitFor(() => { expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '添加远程地址' }))
    const urlField = () => screen.getByPlaceholderText('https://github.com/org/repo.git')
    fireEvent.change(urlField(), { target: { value: 'https://example.com/repo.git' } })
    fireEvent.keyDown(urlField(), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByText('请填写远程仓库地址')).toBeTruthy() })
    fireEvent.change(urlField(), { target: { value: 'https://example.com/other.git' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    await waitFor(() => { expect(screen.getByText('fatal: remote origin already exists.')).toBeTruthy() })
  })

  it('opens the add-remote editor from a missing-remote push error', async () => {
    const gitPush = vi.fn().mockRejectedValue(new DirectoryBrowseError({
      code: 'git-failed',
      message: 'no remote configured',
      details: {},
    }))
    mount({ tree: AHEAD_REPO, gitPush })
    await waitFor(() => { expect(screen.getByRole('button', { name: '推送' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '推送' }))
    confirmPush()
    await waitFor(() => { expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '添加远程地址' }))
    expect(screen.getByPlaceholderText('https://github.com/org/repo.git')).toBeTruthy()
  })

  it('shows origin URL and a delete control when originUrl is set', async () => {
    mount({ tree: ORIGIN_REPO })
    await waitFor(() => { expect(screen.getByRole('button', { name: '删除远程地址' })).toBeTruthy() })
    expect(screen.getByText('https://github.com/org/repo.git')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '添加远程地址' })).toBeNull()
    expect(screen.queryByRole('button', { name: '推送' })).toBeNull()
    expect(screen.queryByText('尚未推送到远程')).toBeNull()
  })

  it('removes origin after confirm and shows the add-remote entry', async () => {
    const gitRemoveRemote = vi.fn(async () => NO_REMOTE_REPO)
    mount({ tree: ORIGIN_REPO, gitRemoveRemote })
    await waitFor(() => { expect(screen.getByRole('button', { name: '删除远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '删除远程地址' }))
    expect(screen.getByRole('dialog', { name: '确认删除远程地址' })).toBeTruthy()
    confirmRemoveRemote()
    await waitFor(() => { expect(gitRemoveRemote).toHaveBeenCalledWith(WID) })
    await waitFor(() => { expect(screen.getByRole('button', { name: '添加远程地址' })).toBeTruthy() })
    expect(screen.queryByRole('button', { name: '删除远程地址' })).toBeNull()
    expect(screen.getByText('已删除远程地址')).toBeTruthy()
  })

  it('does not call Host when remove-remote confirm is cancelled', async () => {
    const gitRemoveRemote = vi.fn(async () => NO_REMOTE_REPO)
    mount({ tree: ORIGIN_REPO, gitRemoveRemote })
    await waitFor(() => { expect(screen.getByRole('button', { name: '删除远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '删除远程地址' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(gitRemoveRemote).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '删除远程地址' })).toBeTruthy()
  })

  it('maps Host remove-remote failures onto the origin row', async () => {
    const gitRemoveRemote = vi.fn().mockRejectedValue(new DirectoryBrowseError({
      code: 'git-failed',
      message: "fatal: could not remove config section 'remote.origin'",
      details: {},
    }))
    mount({ tree: ORIGIN_REPO, gitRemoveRemote })
    await waitFor(() => { expect(screen.getByRole('button', { name: '删除远程地址' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '删除远程地址' }))
    confirmRemoveRemote()
    await waitFor(() => {
      expect(screen.getByText("fatal: could not remove config section 'remote.origin'")).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: '删除远程地址' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
  })

  it('keeps the commit draft when hiding the Git tab', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'wip message' } })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => {
      expect((screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement).value).toBe('wip message')
    })
  })

  it('stores commit drafts per Session and does not clear the other Session', async () => {
    const other = workspace({
      workspaceId: WID2,
      path: '/w/beta',
      title: 'beta',
      sessionIds: [SID2],
    })
    const gitWorkingTree = vi.fn(async (workspaceId: WorkspaceId) => {
      if (workspaceId === WID2) {
        return {
          availability: 'repository' as const,
          repoRoot: '/repos/beta',
          branch: 'topic',
          unstaged: [],
          staged: [change('beta.ts', 'modified', '/repos/beta')],
          pushAvailable: false,
        }
      }
      return DIRTY_REPO
    })
    const b = mount({ gitWorkingTree, items: [workspace(), other] })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'alpha draft' } })
    act(() => {
      b.sessionsStore.update((draft) => {
        draft.ids = [SID, SID2]
        draft.current = SID2
      })
    })
    b.view.rerender(<GitPanel {...b.props} />)
    await waitFor(() => { expect(screen.getByText('beta.ts')).toBeTruthy() })
    expect((screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'beta draft' } })
    act(() => {
      b.sessionsStore.update((draft) => { draft.current = SID })
    })
    b.view.rerender(<GitPanel {...b.props} />)
    await waitFor(() => {
      expect((screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement).value).toBe('alpha draft')
    })
  })

  it('shows a Host write failure in the panel without filling identity', async () => {
    const gitStage = vi.fn(async () => {
      throw new DirectoryBrowseError({ code: 'git-failed', message: 'index.lock', details: {} })
    })
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }))
    await waitFor(() => { expect(screen.getByText('index.lock')).toBeTruthy() })
    expect(screen.queryByLabelText('user.name')).toBeNull()
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
  })

  it('stops staging remaining files after a section-wide stage failure', async () => {
    const gitStage = vi.fn(async () => {
      throw new DirectoryBrowseError({ code: 'git-failed', message: 'index.lock', details: {} })
    })
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部选入' }))
    await waitFor(() => { expect(screen.getByText('index.lock')).toBeTruthy() })
    expect(gitStage).toHaveBeenCalledTimes(1)
  })

  it('default-preview: clicking a row loads the panel preview and does not open an editor tab', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => {
      expect(b.gitDiffPreview).toHaveBeenCalledWith(
        WID, '/repos/app/README.md', 'unstaged', expect.any(AbortSignal),
      )
    })
    const preview = previewPane()
    expect(within(preview).getByText('README.md')).toBeTruthy()
    expect(within(preview).getAllByRole('button', { name: '选入提交' }).length).toBeGreaterThanOrEqual(1)
    expect(within(preview).getByRole('button', { name: '撤销更改' })).toBeTruthy()
    expect(screen.queryByText('选择一个文件或 Graph 中的提交以查看差异')).toBeNull()
    expect(screen.queryByRole('button', { name: '在编辑器中打开' })).toBeNull()
    expect(screen.getAllByText('README.md').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('note.md')).toBeTruthy()
  })

  it('tracked-text: shows line-level hunks with stage/discard-hunk actions on the unstaged side', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('keep')).toBeTruthy()
    expect(within(preview).getAllByText('old').length).toBeGreaterThanOrEqual(1)
    expect(within(preview).getAllByText(/^new$/).length).toBeGreaterThanOrEqual(1)
    expect(within(preview).getByText('line4')).toBeTruthy()
    expect(within(preview).getByText('pad')).toBeTruthy()
    expect(within(preview).getAllByText('tail-').length).toBeGreaterThanOrEqual(1)
    expect(within(preview).queryByText('@@ -1,3 +1,3 @@')).toBeNull()
    expect(within(preview).getAllByRole('button', { name: '选入提交' })).toHaveLength(3)
    expect(within(preview).getAllByRole('button', { name: '撤销此块' })).toHaveLength(2)
    expect(within(preview).queryByRole('button', { name: '移出此块' })).toBeNull()
  })

  it('tracked-text: staged preview exposes unstage-hunk and never discard-hunk', async () => {
    const gitDiffPreview = vi.fn(async () => STAGED_TEXT_PREVIEW)
    mount({ tree: DIRTY_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(rowOf('docs/note.md'))
    const preview = await waitFor(() => previewPane())
    expect(gitDiffPreview).toHaveBeenCalledWith(
      WID, '/repos/app/docs/note.md', 'staged', expect.any(AbortSignal),
    )
    expect(within(preview).getByRole('button', { name: '移出此块' })).toBeTruthy()
    expect(within(preview).queryByRole('button', { name: '选入提交' })).toBeNull()
    expect(within(preview).queryByRole('button', { name: '撤销此块' })).toBeNull()
    expect(within(preview).getByRole('button', { name: '移出提交' })).toBeTruthy()
    expect(within(preview).queryByRole('button', { name: '撤销更改' })).toBeNull()
  })

  it('partial-staged: the same path in both lists loads the matching side', async () => {
    const gitDiffPreview = vi.fn(async (
      _id: WorkspaceId, _path: string, side: 'unstaged' | 'staged',
    ) => side === 'staged' ? STAGED_TEXT_PREVIEW : TEXT_PREVIEW)
    mount({ tree: DIRTY_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getAllByText('a.ts')).toHaveLength(2) })
    fireEvent.click(rowOf('src/a.ts', 0))
    await waitFor(() => {
      expect(gitDiffPreview).toHaveBeenLastCalledWith(
        WID, '/repos/app/src/a.ts', 'unstaged', expect.any(AbortSignal),
      )
    })
    expect(within(previewPane()).getAllByRole('button', { name: '选入提交' })).toHaveLength(3)
    fireEvent.click(rowOf('src/a.ts', 1))
    await waitFor(() => {
      expect(gitDiffPreview).toHaveBeenLastCalledWith(
        WID, '/repos/app/src/a.ts', 'staged', expect.any(AbortSignal),
      )
    })
    expect(within(previewPane()).getByRole('button', { name: '移出此块' })).toBeTruthy()
    expect(within(previewPane()).queryByRole('button', { name: '选入提交' })).toBeNull()
  })

  it('stages one unstaged hunk and keeps the path on both lists', async () => {
    const gitStage = vi.fn(async () => ({
      ...DIRTY_REPO,
      unstaged: [
        change('src/a.ts', 'modified'),
        change('README.md', 'modified'),
      ],
      staged: [
        change('src/a.ts', 'modified'),
        change('docs/note.md', 'modified'),
        change('README.md', 'modified'),
      ],
    }))
    const gitDiffPreview = vi.fn()
      .mockResolvedValueOnce(TEXT_PREVIEW)
      .mockResolvedValueOnce(STAGED_TEXT_PREVIEW)
    mount({ tree: DIRTY_REPO, gitStage, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getAllByRole('button', { name: '选入提交' })[1]!)
    await waitFor(() => {
      expect(gitStage).toHaveBeenCalledWith(WID, '/repos/app/README.md', '@@ -1,3 +1,3 @@')
    })
    await waitFor(() => { expect(screen.getAllByText('README.md').length).toBeGreaterThanOrEqual(2) })
  })

  it('unstages one staged hunk without calling discard', async () => {
    const gitUnstage = vi.fn(async () => DIRTY_REPO)
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    const gitDiffPreview = vi.fn(async () => STAGED_TEXT_PREVIEW)
    mount({ tree: DIRTY_REPO, gitUnstage, gitDiscard, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(rowOf('docs/note.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getByRole('button', { name: '移出此块' }))
    await waitFor(() => {
      expect(gitUnstage).toHaveBeenCalledWith(WID, '/repos/app/docs/note.md', '@@ -1,3 +1,3 @@')
    })
    expect(gitDiscard).not.toHaveBeenCalled()
  })

  it('discard-hunk: confirms then discards only that unstaged hunk', async () => {
    const gitDiscard = vi.fn(async () => DIRTY_REPO)
    mount({ tree: DIRTY_REPO, gitDiscard })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getAllByRole('button', { name: '撤销此块' })[0]!)
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '撤销更改' }))
    expect(within(dialog).getByText(/README\.md/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销' }))
    await waitFor(() => {
      expect(gitDiscard).toHaveBeenCalledWith(WID, '/repos/app/README.md', '@@ -1,3 +1,3 @@')
    })
  })

  it('discard-hunk: cancel does not call Host', async () => {
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitDiscard })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getAllByRole('button', { name: '撤销此块' })[0]!)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(gitDiscard).not.toHaveBeenCalled()
  })

  it('untracked-text: previews the whole file as additions and only offers whole-file actions', async () => {
    const gitDiffPreview = vi.fn(async () => ({
      kind: 'untracked-text' as const,
      text: 'brand new\nline two\n',
    }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('new.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('new.ts')).getByText('new.ts'))
    const preview = await waitFor(() => previewPane())
    expect(preview.textContent).toMatch(/brand new/)
    expect(preview.textContent).toMatch(/line two/)
    expect(within(preview).getAllByRole('button', { name: '选入提交' })).toHaveLength(1)
    expect(within(preview).queryByRole('button', { name: '撤销此块' })).toBeNull()
    expect(within(preview).getByRole('button', { name: '撤销更改' })).toBeTruthy()
  })

  it('binary: shows 二进制文件有差异 and only whole-file actions', async () => {
    const gitDiffPreview = vi.fn(async () => ({ kind: 'binary' as const }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('photo.bin')).toBeTruthy() })
    fireEvent.click(within(rowOf('photo.bin')).getByText('photo.bin'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('二进制文件有差异')).toBeTruthy()
    expect(within(preview).getAllByRole('button', { name: '选入提交' })).toHaveLength(1)
    expect(within(preview).getByRole('button', { name: '撤销更改' })).toBeTruthy()
  })

  it('deletion: shows deleted text and only whole-file actions', async () => {
    const gitDiffPreview = vi.fn(async () => ({
      kind: 'deleted-text' as const,
      text: 'gone line\n',
    }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('gone.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('gone.ts')).getByText('gone.ts'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('gone line')).toBeTruthy()
    expect(within(preview).getAllByRole('button', { name: '选入提交' })).toHaveLength(1)
    expect(within(preview).queryByRole('button', { name: '撤销此块' })).toBeNull()
    expect(within(preview).getByRole('button', { name: '撤销更改' })).toBeTruthy()
  })

  it('deletion: deleted binary uses the binary card', async () => {
    const gitDiffPreview = vi.fn(async () => ({ kind: 'deleted-binary' as const }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('blob.bin')).toBeTruthy() })
    fireEvent.click(within(rowOf('blob.bin')).getByText('blob.bin'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('二进制文件有差异')).toBeTruthy()
    expect(within(preview).getAllByRole('button', { name: '选入提交' })).toHaveLength(1)
  })

  it('outside-bound-workspace: previews and stages a path outside the bound Workspace', async () => {
    const gitStage = vi.fn(async () => PREVIEW_KINDS_REPO)
    const gitDiffPreview = vi.fn(async () => TEXT_PREVIEW)
    mount({ tree: PREVIEW_KINDS_REPO, gitStage, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('outside.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('outside.ts')).getByText('outside.ts'))
    const preview = await waitFor(() => previewPane())
    expect(gitDiffPreview).toHaveBeenCalledWith(
      WID, '/repos/outside.ts', 'unstaged', expect.any(AbortSignal),
    )
    expect(within(preview).getByText('outside.ts')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '在编辑器中打开' })).toBeNull()
    fireEvent.click(within(preview).getAllByRole('button', { name: '选入提交' })[0]!)
    await waitFor(() => {
      expect(gitStage).toHaveBeenCalledWith(WID, '/repos/outside.ts')
    })
  })

  it('merge-conflict: shows the working-tree diff without merge-editor controls', async () => {
    const gitDiffPreview = vi.fn(async () => TEXT_PREVIEW)
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('conflict.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('conflict.ts')).getByText('conflict.ts'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('keep')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Current' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abort' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
    expect(within(preview).getAllByRole('button', { name: '选入提交' }).length).toBeGreaterThanOrEqual(1)
    expect(within(preview).getByRole('button', { name: '撤销更改' })).toBeTruthy()
  })

  it('shows a preview Host failure inside the preview pane', async () => {
    const gitDiffPreview = vi.fn(async () => {
      throw new DirectoryBrowseError({ code: 'git-failed', message: 'diff exploded', details: {} })
    })
    mount({ tree: DIRTY_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => { expect(within(previewPane()).getByText('diff exploded')).toBeTruthy() })
    expect(screen.getAllByText('README.md').length).toBeGreaterThanOrEqual(2)
  })

  it('drops a preview result that arrives after the selection is superseded', async () => {
    let settleFirst!: (preview: GitDiffPreview) => void
    const gitDiffPreview = vi.fn((_id: WorkspaceId, path: string) => {
      if (path.endsWith('README.md')) {
        return new Promise<GitDiffPreview>((resolve) => { settleFirst = resolve })
      }
      return Promise.resolve(STAGED_TEXT_PREVIEW)
    })
    mount({ tree: DIRTY_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    fireEvent.click(rowOf('docs/note.md'))
    await waitFor(() => {
      expect(within(previewPane()).getByRole('button', { name: '移出此块' })).toBeTruthy()
    })
    await act(async () => { settleFirst(TEXT_PREVIEW) })
    expect(within(previewPane()).queryByRole('button', { name: '选入提交' })).toBeNull()
    expect(within(previewPane()).getByText('docs/note.md')).toBeTruthy()
  })

  it('does not refetch when clicking the already selected row', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => { expect(within(previewPane()).getByText('keep')).toBeTruthy() })
    expect(b.gitDiffPreview).toHaveBeenCalledTimes(1)
    fireEvent.click(rowOf('README.md'))
    await act(async () => { await Promise.resolve() })
    expect(b.gitDiffPreview).toHaveBeenCalledTimes(1)
  })

  it('does not start a preview read while the Git tab is hidden', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => { expect(within(previewPane()).getByText('keep')).toBeTruthy() })
    const calls = b.gitDiffPreview.mock.calls.length
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    await act(async () => { await Promise.resolve() })
    expect(b.gitDiffPreview.mock.calls.length).toBe(calls)
    expect(within(previewPane()).getByText('keep')).toBeTruthy()
  })

  it('ignores an AbortError from a superseded preview read', async () => {
    const gitDiffPreview = vi.fn(async () => {
      const error = new Error('preview aborted')
      error.name = 'AbortError'
      throw error
    })
    mount({ tree: DIRTY_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText('preview aborted')).toBeNull()
  })

  it('preview toolbar: whole-file discard confirms and unstage does not call discard', async () => {
    const gitDiscard = vi.fn(async () => DIRTY_REPO)
    const gitUnstage = vi.fn(async () => DIRTY_REPO)
    mount({ tree: DIRTY_REPO, gitDiscard, gitUnstage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const unstagedPreview = await waitFor(() => previewPane())
    fireEvent.click(within(unstagedPreview).getByRole('button', { name: '撤销更改' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认撤销' }))
    await waitFor(() => {
      expect(gitDiscard).toHaveBeenCalledWith(WID, '/repos/app/README.md')
    })
    fireEvent.click(rowOf('docs/note.md'))
    const stagedPreview = await waitFor(() => previewPane())
    fireEvent.click(within(stagedPreview).getByRole('button', { name: '移出提交' }))
    await waitFor(() => {
      expect(gitUnstage).toHaveBeenCalledWith(WID, '/repos/app/docs/note.md')
    })
    expect(gitDiscard).toHaveBeenCalledTimes(1)
  })

  it('ignores a second click on a disabled section action while a write is in flight', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitStage = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }))
    await waitFor(() => {
      expect(within(rowOf('README.md')).getByRole('status', { name: '正在选入…' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '全部选入' }))
    expect(gitStage).toHaveBeenCalledTimes(1)
    await act(async () => { settle(DIRTY_REPO) })
  })

  it('untracked-text: an empty file still renders as a whole-file addition', async () => {
    const gitDiffPreview = vi.fn(async () => ({ kind: 'untracked-text' as const, text: '' }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('new.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('new.ts')).getByText('new.ts'))
    await waitFor(() => {
      expect(within(previewPane()).getAllByRole('button', { name: '选入提交' })).toHaveLength(1)
    })
    expect(within(previewPane()).queryByRole('button', { name: '撤销此块' })).toBeNull()
  })

  it('deletion: text without a trailing newline still renders', async () => {
    const gitDiffPreview = vi.fn(async () => ({ kind: 'deleted-text' as const, text: 'gone line' }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('gone.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('gone.ts')).getByText('gone.ts'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('gone line')).toBeTruthy()
  })

  it('clears the preview when a later working-tree read is not a repository', async () => {
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce(DIRTY_REPO)
      .mockResolvedValueOnce({ availability: 'not-a-repository' })
    const b = mount({ gitWorkingTree })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => { expect(within(previewPane()).getByText('keep')).toBeTruthy() })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(screen.getByText('不是 Git 仓库')).toBeTruthy() })
  })

  it('keeps an unstaged selection after the working tree refreshes', async () => {
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce(DIRTY_REPO)
      .mockResolvedValueOnce(DIRTY_REPO)
    const b = mount({ gitWorkingTree })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => {
      expect(within(previewPane()).getAllByRole('button', { name: '选入提交' }).length).toBeGreaterThan(0)
    })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(gitWorkingTree).toHaveBeenCalledTimes(2) })
    await waitFor(() => {
      expect(within(previewPane()).getAllByRole('button', { name: '选入提交' }).length).toBeGreaterThan(0)
    })
  })

  it('keeps a staged selection after the working tree refreshes', async () => {
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce(DIRTY_REPO)
      .mockResolvedValueOnce(DIRTY_REPO)
    const gitDiffPreview = vi.fn(async () => STAGED_TEXT_PREVIEW)
    const b = mount({ gitWorkingTree, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(rowOf('docs/note.md'))
    await waitFor(() => { expect(within(previewPane()).getByRole('button', { name: '移出此块' })).toBeTruthy() })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(gitWorkingTree).toHaveBeenCalledTimes(2) })
    await waitFor(() => { expect(within(previewPane()).getByRole('button', { name: '移出此块' })).toBeTruthy() })
  })

  it('clears an unstaged preview when that path leaves the refreshed list', async () => {
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce(DIRTY_REPO)
      .mockResolvedValueOnce({
        ...DIRTY_REPO,
        unstaged: [change('src/a.ts', 'modified')],
      })
    const b = mount({ gitWorkingTree })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    await waitFor(() => { expect(within(previewPane()).getByText('keep')).toBeTruthy() })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(screen.getByText('选择一个文件或 Graph 中的提交以查看差异')).toBeTruthy() })
    expect(screen.queryByText('README.md')).toBeNull()
  })

  it('clears a staged preview when that path leaves the refreshed list', async () => {
    const gitWorkingTree = vi.fn()
      .mockResolvedValueOnce(DIRTY_REPO)
      .mockResolvedValueOnce({
        ...DIRTY_REPO,
        staged: [change('src/a.ts', 'modified')],
      })
    const gitDiffPreview = vi.fn(async () => STAGED_TEXT_PREVIEW)
    const b = mount({ gitWorkingTree, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(rowOf('docs/note.md'))
    await waitFor(() => { expect(within(previewPane()).getByRole('button', { name: '移出此块' })).toBeTruthy() })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(screen.getByText('选择一个文件或 Graph 中的提交以查看差异')).toBeTruthy() })
    expect(screen.queryByText('note.md')).toBeNull()
  })

  it('dirty-disabled: dirty unstaged stage/discard are aria-disabled; unstage stays enabled', async () => {
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md', '/repos/app/docs/note.md'] })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }).getAttribute('aria-disabled')).toBe('true')
    expect(within(rowOf('README.md')).getByRole('button', { name: '撤销更改' }).getAttribute('aria-disabled')).toBe('true')
    expect(within(rowOf('src/a.ts')).getByRole('button', { name: '选入提交' }).getAttribute('aria-disabled')).toBeNull()
    expect(within(rowOf('docs/note.md')).getByRole('button', { name: '移出提交' }).getAttribute('aria-disabled')).toBeNull()
  })

  it('commit-blocked: a dirty staged path keeps 提交 disabled after a message', async () => {
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/docs/note.md'] })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'ready' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
  })

  it('guard-dialog: staging a dirty path opens the guard and does not call Host', async () => {
    const gitStage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '选入提交' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '文件有未保存的编辑' }))
    expect(within(dialog).getByText('/repos/app/README.md')).toBeTruthy()
    expect(within(dialog).getByText('请先显式保存、丢弃该编辑缓冲或关闭该标签页。不会自动保存。')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: '保存' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '文件有未保存的编辑' })).toBeNull()
    expect(gitStage).not.toHaveBeenCalled()
  })

  it('guard-dialog: discarding a dirty path opens the guard instead of the discard confirm', async () => {
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitDiscard })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '撤销更改' }))
    expect(screen.queryByRole('dialog', { name: '撤销更改' })).toBeNull()
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '文件有未保存的编辑' }))
    expect(within(dialog).getByText('/repos/app/README.md')).toBeTruthy()
    expect(gitDiscard).not.toHaveBeenCalled()
  })

  it('unstages a dirty staged path without opening the guard', async () => {
    const gitUnstage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/docs/note.md'], gitUnstage })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('docs/note.md')).getByRole('button', { name: '移出提交' }))
    await waitFor(() => {
      expect(gitUnstage).toHaveBeenCalledWith(WID, '/repos/app/docs/note.md')
    })
    expect(screen.queryByRole('dialog', { name: '文件有未保存的编辑' })).toBeNull()
  })

  it('guard-dialog: staging a dirty hunk opens the guard and does not call Host', async () => {
    const gitStage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getAllByRole('button', { name: '选入提交' })[1]!)
    expect(await screen.findByRole('dialog', { name: '文件有未保存的编辑' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(within(preview).getAllByRole('button', { name: '选入提交' })[1]!)
    expect(await screen.findByRole('dialog', { name: '文件有未保存的编辑' })).toBeTruthy()
    expect(gitStage).not.toHaveBeenCalled()
  })

  it('guard-dialog: discarding a dirty hunk opens the guard and does not call Host', async () => {
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitDiscard })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getAllByRole('button', { name: '撤销此块' })[0]!)
    expect(await screen.findByRole('dialog', { name: '文件有未保存的编辑' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: '撤销更改' })).toBeNull()
    expect(gitDiscard).not.toHaveBeenCalled()
  })

  it('unstages a dirty hunk without opening the guard', async () => {
    const gitUnstage = vi.fn(async () => DIRTY_REPO)
    const gitDiffPreview = vi.fn(async () => STAGED_TEXT_PREVIEW)
    mount({
      tree: DIRTY_REPO,
      dirtyPaths: ['/repos/app/docs/note.md'],
      gitUnstage,
      gitDiffPreview,
    })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(rowOf('docs/note.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getByRole('button', { name: '移出此块' }))
    await waitFor(() => {
      expect(gitUnstage).toHaveBeenCalledWith(WID, '/repos/app/docs/note.md', '@@ -1,3 +1,3 @@')
    })
    expect(screen.queryByRole('dialog', { name: '文件有未保存的编辑' })).toBeNull()
  })

  it('guard-dialog: stage-all with a dirty path opens the guard and stages nothing', async () => {
    const gitStage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitStage })
    await waitFor(() => { expect(screen.getByRole('button', { name: '全部选入' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部选入' }))
    expect(await screen.findByRole('dialog', { name: '文件有未保存的编辑' })).toBeTruthy()
    expect(gitStage).not.toHaveBeenCalled()
  })

  it('session switch with a commit-message draft does not open the Git action guard', async () => {
    const other = workspace({
      workspaceId: WID2,
      path: '/w/beta',
      title: 'beta',
      sessionIds: [SID2],
    })
    const gitWorkingTree = vi.fn(async (workspaceId: WorkspaceId) => {
      if (workspaceId === WID2) {
        return {
          availability: 'repository' as const,
          repoRoot: '/repos/beta',
          branch: 'topic',
          unstaged: [],
          staged: [change('beta.ts', 'modified', '/repos/beta')],
          pushAvailable: false,
        }
      }
      return DIRTY_REPO
    })
    const b = mount({ gitWorkingTree, items: [workspace(), other] })
    await waitFor(() => { expect(screen.getByPlaceholderText('请填写提交备注信息')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('请填写提交备注信息'), { target: { value: 'alpha draft' } })
    act(() => {
      b.sessionsStore.update((draft) => {
        draft.ids = [SID, SID2]
        draft.current = SID2
      })
    })
    b.view.rerender(<GitPanel {...b.props} />)
    await waitFor(() => { expect(screen.getByText('beta.ts')).toBeTruthy() })
    expect(screen.queryByRole('dialog', { name: '文件有未保存的编辑' })).toBeNull()
    expect((screen.getByPlaceholderText('请填写提交备注信息') as HTMLTextAreaElement).value).toBe('')
  })
})
