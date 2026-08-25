// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  GitDiffPreview, GitWorkingTreeChange, GitWorkingTreeResult, SessionId, SessionListState,
  WorkspaceId, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore, DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { GitPanel, type GitPanelProps } from '../src/client/GitPanel.tsx'
import { createGitPanelStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const SID = 's1' as SessionId
const SID2 = 's2' as SessionId
const WID = 'ws1' as WorkspaceId
const WID2 = 'ws2' as WorkspaceId
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
}

const DIRTY_REPO: GitWorkingTreeResult = {
  availability: 'repository',
  repoRoot: '/repos/app',
  branch: 'HEAD detached at abc1234',
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
  const items = over.items ?? [workspace()]
  const workspacesStore = createSnapshotStore(workspacesState(items))
  const sessionsStore = createSnapshotStore(sessionsState(
    over.noCurrentSession ? undefined : (over.sessionId ?? SID),
  ))
  const panelStore = createGitPanelStore().create()
  const props = {
    visible: over.visible ?? true,
    dirtyPaths: over.dirtyPaths ?? [],
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
  } as GitPanelProps
  const view = render(<GitPanel {...props} />)
  return {
    view, props, sessionsStore, workspacesStore, panelStore,
    gitWorkingTree, gitInit, gitDiffPreview, gitStage, gitUnstage, gitDiscard, gitCommit,
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
    await waitFor(() => { expect(screen.getByText('没有要提交的更改')).toBeTruthy() })
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

  it('empty-clean: shows 没有要提交的更改 and keeps the commit placeholder', async () => {
    mount({ tree: CLEAN_REPO })
    await waitFor(() => { expect(screen.getByText('没有要提交的更改')).toBeTruthy() })
    expect(screen.getByText('提交到分支 main')).toBeTruthy()
    expect(screen.getByPlaceholderText('提交说明')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
    expect(screen.getByText('选择一个文件以查看差异')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '初始化仓库' })).toBeNull()
  })

  it('default: binds the Session Workspace, lists both sides, and shows a detached HEAD', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getAllByText('a.ts').length).toBe(2) })
    expect(b.gitWorkingTree).toHaveBeenCalledWith(WID, expect.any(AbortSignal))
    expect(screen.getByText('提交到分支 HEAD detached at abc1234')).toBeTruthy()
    expect(screen.getByText('未选入提交')).toBeTruthy()
    expect(screen.getByText('已选入提交')).toBeTruthy()
    expect(screen.getAllByText('a.ts')).toHaveLength(2)
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.getByText('note.md')).toBeTruthy()
    expect(screen.getByText('docs')).toBeTruthy()
    expect(screen.queryByText('node_modules/pkg.js')).toBeNull()
    expect(screen.getByText('选择一个文件以查看差异')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '初始化仓库' })).toBeNull()
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
    expect(screen.queryByPlaceholderText('提交说明')).toBeNull()
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
    await waitFor(() => { expect(screen.getByText('没有要提交的更改')).toBeTruthy() })
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

  it('default: unstaged rows expose stage and discard; staged rows only unstage', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(within(rowOf('README.md')).getByRole('button', { name: '暂存' })).toBeTruthy()
    expect(within(rowOf('README.md')).getByRole('button', { name: '丢弃' })).toBeTruthy()
    expect(within(rowOf('docs/note.md')).getByRole('button', { name: '取消暂存' })).toBeTruthy()
    expect(within(rowOf('docs/note.md')).queryByRole('button', { name: '丢弃' })).toBeNull()
    expect(screen.getByRole('button', { name: '全部暂存' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '全部取消暂存' })).toBeTruthy()
  })

  it('shows a hover tooltip on row icon actions', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    vi.useFakeTimers()
    try {
      fireEvent.mouseEnter(within(rowOf('README.md')).getByRole('button', { name: '暂存' }))
      act(() => { vi.advanceTimersByTime(500) })
      expect(screen.getByRole('tooltip').textContent).toBe('暂存')
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
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '暂存' }))
    await waitFor(() => {
      expect(gitStage).toHaveBeenCalledWith(WID, '/repos/app/README.md')
    })
    await waitFor(() => {
      expect(within(rowOf('README.md')).queryByRole('button', { name: '暂存' })).toBeNull()
      expect(within(rowOf('README.md')).getByRole('button', { name: '取消暂存' })).toBeTruthy()
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
    fireEvent.click(within(rowOf('docs/note.md')).getByRole('button', { name: '取消暂存' }))
    await waitFor(() => {
      expect(gitUnstage).toHaveBeenCalledWith(WID, '/repos/app/docs/note.md')
    })
    expect(gitDiscard).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(within(rowOf('docs/note.md')).getByRole('button', { name: '暂存' })).toBeTruthy()
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
    await waitFor(() => { expect(screen.getByRole('button', { name: '全部暂存' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部暂存' }))
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
    await waitFor(() => { expect(screen.getByRole('button', { name: '全部取消暂存' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部取消暂存' }))
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
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '暂存' }))
    await waitFor(() => {
      expect(within(rowOf('README.md')).getByRole('status', { name: '正在暂存' })).toBeTruthy()
    })
    await act(async () => { settle(DIRTY_REPO) })
  })

  it('discard-confirm: tracked modification copy, cancel does not call Host', async () => {
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DISCARD_REPO, gitDiscard })
    await waitFor(() => { expect(screen.getByText('tracked.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('tracked.ts')).getByRole('button', { name: '丢弃' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '丢弃更改' }))
    expect(within(dialog).getByText(/tracked\.ts/)).toBeTruthy()
    expect(within(dialog).getByText('将把磁盘内容恢复为暂存区或 HEAD')).toBeTruthy()
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
    fireEvent.click(within(rowOf('new.ts')).getByRole('button', { name: '丢弃' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '丢弃未跟踪文件' }))
    expect(within(dialog).getByText('将从磁盘删除该路径')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '丢弃' }))
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
    fireEvent.click(within(rowOf('gone.ts')).getByRole('button', { name: '丢弃' }))
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '丢弃更改' }))
    expect(within(dialog).getByText('将把文件恢复到磁盘')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '丢弃' }))
    await waitFor(() => {
      expect(gitDiscard).toHaveBeenCalledWith(WID, '/repos/app/gone.ts')
    })
  })

  it('commit-disabled: empty staged or empty message keeps 提交 disabled', async () => {
    mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    const input = screen.getByPlaceholderText('提交说明')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
    fireEvent.change(input, { target: { value: '   ' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
    expect(screen.getByText('请填写提交说明')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'ready' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(false)
  })

  it('commit-disabled: a clean staged list stays disabled after typing a message', async () => {
    mount({ tree: CLEAN_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'nothing staged' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
    expect(screen.queryByText('请填写提交说明')).toBeNull()
  })

  it('commit-in-progress: disables the submit button and shows a spinner', async () => {
    let settle!: (tree: GitWorkingTreeResult) => void
    const gitCommit = vi.fn(() => new Promise<GitWorkingTreeResult>((resolve) => { settle = resolve }))
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'wip' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
      expect(screen.getByRole('status', { name: '正在提交' })).toBeTruthy()
    })
    await act(async () => { settle(CLEAN_REPO) })
  })

  it('commits the current index and clears this Session draft', async () => {
    const gitCommit = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, gitCommit })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    const input = screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'ship it' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    await waitFor(() => {
      expect(gitCommit).toHaveBeenCalledWith(WID, 'ship it')
    })
    await waitFor(() => {
      expect((screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement).value).toBe('')
      expect(screen.getByText('没有要提交的更改')).toBeTruthy()
    })
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
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'identity' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    await waitFor(() => { expect(screen.getByText('Author identity unknown')).toBeTruthy() })
    expect(screen.queryByLabelText('user.name')).toBeNull()
    expect(screen.queryByLabelText('user.email')).toBeNull()
    expect((screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement).value).toBe('identity')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => { expect(gitCommit).toHaveBeenCalledTimes(2) })
    await waitFor(() => {
      expect((screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement).value).toBe('')
    })
  })

  it('keeps the commit draft when hiding the Git tab', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'wip message' } })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => {
      expect((screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement).value).toBe('wip message')
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
        }
      }
      return DIRTY_REPO
    })
    const b = mount({ gitWorkingTree, items: [workspace(), other] })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'alpha draft' } })
    act(() => {
      b.sessionsStore.update((draft) => {
        draft.ids = [SID, SID2]
        draft.current = SID2
      })
    })
    b.view.rerender(<GitPanel {...b.props} />)
    await waitFor(() => { expect(screen.getByText('beta.ts')).toBeTruthy() })
    expect((screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'beta draft' } })
    act(() => {
      b.sessionsStore.update((draft) => { draft.current = SID })
    })
    b.view.rerender(<GitPanel {...b.props} />)
    await waitFor(() => {
      expect((screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement).value).toBe('alpha draft')
    })
  })

  it('shows a Host write failure in the panel without filling identity', async () => {
    const gitStage = vi.fn(async () => {
      throw new DirectoryBrowseError({ code: 'git-failed', message: 'index.lock', details: {} })
    })
    mount({ tree: DIRTY_REPO, gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '暂存' }))
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
    fireEvent.click(screen.getByRole('button', { name: '全部暂存' }))
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
    expect(within(preview).getByRole('button', { name: '暂存' })).toBeTruthy()
    expect(within(preview).getByRole('button', { name: '丢弃' })).toBeTruthy()
    expect(screen.queryByText('选择一个文件以查看差异')).toBeNull()
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
    expect(within(preview).getAllByRole('button', { name: '暂存块' })).toHaveLength(2)
    expect(within(preview).getAllByRole('button', { name: '丢弃块' })).toHaveLength(2)
    expect(within(preview).queryByRole('button', { name: '取消暂存块' })).toBeNull()
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
    expect(within(preview).getByRole('button', { name: '取消暂存块' })).toBeTruthy()
    expect(within(preview).queryByRole('button', { name: '暂存块' })).toBeNull()
    expect(within(preview).queryByRole('button', { name: '丢弃块' })).toBeNull()
    expect(within(preview).getByRole('button', { name: '取消暂存' })).toBeTruthy()
    expect(within(preview).queryByRole('button', { name: '丢弃' })).toBeNull()
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
    expect(within(previewPane()).getAllByRole('button', { name: '暂存块' })).toHaveLength(2)
    fireEvent.click(rowOf('src/a.ts', 1))
    await waitFor(() => {
      expect(gitDiffPreview).toHaveBeenLastCalledWith(
        WID, '/repos/app/src/a.ts', 'staged', expect.any(AbortSignal),
      )
    })
    expect(within(previewPane()).getByRole('button', { name: '取消暂存块' })).toBeTruthy()
    expect(within(previewPane()).queryByRole('button', { name: '暂存块' })).toBeNull()
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
    fireEvent.click(within(preview).getAllByRole('button', { name: '暂存块' })[0]!)
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
    fireEvent.click(within(preview).getByRole('button', { name: '取消暂存块' }))
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
    fireEvent.click(within(preview).getAllByRole('button', { name: '丢弃块' })[0]!)
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '丢弃更改' }))
    expect(within(dialog).getByText(/README\.md/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '丢弃' }))
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
    fireEvent.click(within(preview).getAllByRole('button', { name: '丢弃块' })[0]!)
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
    expect(within(preview).getByText('brand new')).toBeTruthy()
    expect(within(preview).getByText('line two')).toBeTruthy()
    expect(within(preview).queryByRole('button', { name: '暂存块' })).toBeNull()
    expect(within(preview).queryByRole('button', { name: '丢弃块' })).toBeNull()
    expect(within(preview).getByRole('button', { name: '暂存' })).toBeTruthy()
    expect(within(preview).getByRole('button', { name: '丢弃' })).toBeTruthy()
  })

  it('binary: shows 二进制文件有差异 and only whole-file actions', async () => {
    const gitDiffPreview = vi.fn(async () => ({ kind: 'binary' as const }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('photo.bin')).toBeTruthy() })
    fireEvent.click(within(rowOf('photo.bin')).getByText('photo.bin'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('二进制文件有差异')).toBeTruthy()
    expect(within(preview).queryByRole('button', { name: '暂存块' })).toBeNull()
    expect(within(preview).getByRole('button', { name: '暂存' })).toBeTruthy()
    expect(within(preview).getByRole('button', { name: '丢弃' })).toBeTruthy()
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
    expect(within(preview).queryByRole('button', { name: '暂存块' })).toBeNull()
    expect(within(preview).queryByRole('button', { name: '丢弃块' })).toBeNull()
    expect(within(preview).getByRole('button', { name: '暂存' })).toBeTruthy()
    expect(within(preview).getByRole('button', { name: '丢弃' })).toBeTruthy()
  })

  it('deletion: deleted binary uses the binary card', async () => {
    const gitDiffPreview = vi.fn(async () => ({ kind: 'deleted-binary' as const }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('blob.bin')).toBeTruthy() })
    fireEvent.click(within(rowOf('blob.bin')).getByText('blob.bin'))
    const preview = await waitFor(() => previewPane())
    expect(within(preview).getByText('二进制文件有差异')).toBeTruthy()
    expect(within(preview).queryByRole('button', { name: '暂存块' })).toBeNull()
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
    fireEvent.click(within(preview).getByRole('button', { name: '暂存' }))
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
    expect(within(preview).getByRole('button', { name: '暂存' })).toBeTruthy()
    expect(within(preview).getByRole('button', { name: '丢弃' })).toBeTruthy()
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
      expect(within(previewPane()).getByRole('button', { name: '取消暂存块' })).toBeTruthy()
    })
    await act(async () => { settleFirst(TEXT_PREVIEW) })
    expect(within(previewPane()).queryByRole('button', { name: '暂存块' })).toBeNull()
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
    fireEvent.click(within(unstagedPreview).getByRole('button', { name: '丢弃' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '丢弃' }))
    await waitFor(() => {
      expect(gitDiscard).toHaveBeenCalledWith(WID, '/repos/app/README.md')
    })
    fireEvent.click(rowOf('docs/note.md'))
    const stagedPreview = await waitFor(() => previewPane())
    fireEvent.click(within(stagedPreview).getByRole('button', { name: '取消暂存' }))
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
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '暂存' }))
    await waitFor(() => {
      expect(within(rowOf('README.md')).getByRole('status', { name: '正在暂存' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '全部暂存' }))
    expect(gitStage).toHaveBeenCalledTimes(1)
    await act(async () => { settle(DIRTY_REPO) })
  })

  it('untracked-text: an empty file still renders as a whole-file addition', async () => {
    const gitDiffPreview = vi.fn(async () => ({ kind: 'untracked-text' as const, text: '' }))
    mount({ tree: PREVIEW_KINDS_REPO, gitDiffPreview })
    await waitFor(() => { expect(screen.getByText('new.ts')).toBeTruthy() })
    fireEvent.click(within(rowOf('new.ts')).getByText('new.ts'))
    await waitFor(() => { expect(within(previewPane()).getByRole('button', { name: '暂存' })).toBeTruthy() })
    expect(within(previewPane()).queryByRole('button', { name: '暂存块' })).toBeNull()
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
      expect(within(previewPane()).getAllByRole('button', { name: '暂存块' }).length).toBeGreaterThan(0)
    })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(gitWorkingTree).toHaveBeenCalledTimes(2) })
    await waitFor(() => {
      expect(within(previewPane()).getAllByRole('button', { name: '暂存块' }).length).toBeGreaterThan(0)
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
    await waitFor(() => { expect(within(previewPane()).getByRole('button', { name: '取消暂存块' })).toBeTruthy() })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(gitWorkingTree).toHaveBeenCalledTimes(2) })
    await waitFor(() => { expect(within(previewPane()).getByRole('button', { name: '取消暂存块' })).toBeTruthy() })
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
    await waitFor(() => { expect(screen.getByText('选择一个文件以查看差异')).toBeTruthy() })
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
    await waitFor(() => { expect(within(previewPane()).getByRole('button', { name: '取消暂存块' })).toBeTruthy() })
    b.view.rerender(<GitPanel {...b.props} visible={false} />)
    b.view.rerender(<GitPanel {...b.props} visible={true} />)
    await waitFor(() => { expect(screen.getByText('选择一个文件以查看差异')).toBeTruthy() })
    expect(screen.queryByText('note.md')).toBeNull()
  })

  it('dirty-disabled: dirty unstaged stage/discard are aria-disabled; unstage stays enabled', async () => {
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md', '/repos/app/docs/note.md'] })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(within(rowOf('README.md')).getByRole('button', { name: '暂存' }).getAttribute('aria-disabled')).toBe('true')
    expect(within(rowOf('README.md')).getByRole('button', { name: '丢弃' }).getAttribute('aria-disabled')).toBe('true')
    expect(within(rowOf('src/a.ts')).getByRole('button', { name: '暂存' }).getAttribute('aria-disabled')).toBeNull()
    expect(within(rowOf('docs/note.md')).getByRole('button', { name: '取消暂存' }).getAttribute('aria-disabled')).toBeNull()
  })

  it('commit-blocked: a dirty staged path keeps 提交 disabled after a message', async () => {
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/docs/note.md'] })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'ready' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
  })

  it('guard-dialog: staging a dirty path opens the guard and does not call Host', async () => {
    const gitStage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitStage })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '暂存' }))
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
    fireEvent.click(within(rowOf('README.md')).getByRole('button', { name: '丢弃' }))
    expect(screen.queryByRole('dialog', { name: '丢弃更改' })).toBeNull()
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: '文件有未保存的编辑' }))
    expect(within(dialog).getByText('/repos/app/README.md')).toBeTruthy()
    expect(gitDiscard).not.toHaveBeenCalled()
  })

  it('unstages a dirty staged path without opening the guard', async () => {
    const gitUnstage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/docs/note.md'], gitUnstage })
    await waitFor(() => { expect(screen.getByText('note.md')).toBeTruthy() })
    fireEvent.click(within(rowOf('docs/note.md')).getByRole('button', { name: '取消暂存' }))
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
    fireEvent.click(within(preview).getByRole('button', { name: '暂存' }))
    expect(await screen.findByRole('dialog', { name: '文件有未保存的编辑' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(within(preview).getAllByRole('button', { name: '暂存块' })[0]!)
    expect(await screen.findByRole('dialog', { name: '文件有未保存的编辑' })).toBeTruthy()
    expect(gitStage).not.toHaveBeenCalled()
  })

  it('guard-dialog: discarding a dirty hunk opens the guard and does not call Host', async () => {
    const gitDiscard = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitDiscard })
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    fireEvent.click(rowOf('README.md'))
    const preview = await waitFor(() => previewPane())
    fireEvent.click(within(preview).getAllByRole('button', { name: '丢弃块' })[0]!)
    expect(await screen.findByRole('dialog', { name: '文件有未保存的编辑' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: '丢弃更改' })).toBeNull()
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
    fireEvent.click(within(preview).getByRole('button', { name: '取消暂存块' }))
    await waitFor(() => {
      expect(gitUnstage).toHaveBeenCalledWith(WID, '/repos/app/docs/note.md', '@@ -1,3 +1,3 @@')
    })
    expect(screen.queryByRole('dialog', { name: '文件有未保存的编辑' })).toBeNull()
  })

  it('guard-dialog: stage-all with a dirty path opens the guard and stages nothing', async () => {
    const gitStage = vi.fn(async () => CLEAN_REPO)
    mount({ tree: DIRTY_REPO, dirtyPaths: ['/repos/app/README.md'], gitStage })
    await waitFor(() => { expect(screen.getByRole('button', { name: '全部暂存' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全部暂存' }))
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
        }
      }
      return DIRTY_REPO
    })
    const b = mount({ gitWorkingTree, items: [workspace(), other] })
    await waitFor(() => { expect(screen.getByPlaceholderText('提交说明')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText('提交说明'), { target: { value: 'alpha draft' } })
    act(() => {
      b.sessionsStore.update((draft) => {
        draft.ids = [SID, SID2]
        draft.current = SID2
      })
    })
    b.view.rerender(<GitPanel {...b.props} />)
    await waitFor(() => { expect(screen.getByText('beta.ts')).toBeTruthy() })
    expect(screen.queryByRole('dialog', { name: '文件有未保存的编辑' })).toBeNull()
    expect((screen.getByPlaceholderText('提交说明') as HTMLTextAreaElement).value).toBe('')
  })
})
