// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  GitWorkingTreeChange, GitWorkingTreeResult, SessionId, SessionListState, WorkspaceId, WorkspaceListState,
  WorkspaceView,
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

function mount(over: {
  visible?: boolean
  items?: WorkspaceView[]
  sessionId?: SessionId
  noCurrentSession?: boolean
  tree?: GitWorkingTreeResult | Promise<GitWorkingTreeResult>
  gitWorkingTree?: GitPanelProps['gitWorkingTree']
  gitInit?: GitPanelProps['gitInit']
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
    t: makeTranslate(zh),
    useSessions: hookOf(sessionsStore),
    useWorkspaces: hookOf(workspacesStore),
    useStore: hookOf(panelStore),
    actions: panelStore.actions,
    gitWorkingTree,
    gitInit,
    gitStage,
    gitUnstage,
    gitDiscard,
    gitCommit,
  } as GitPanelProps
  const view = render(<GitPanel {...props} />)
  return {
    view, props, sessionsStore, workspacesStore, panelStore,
    gitWorkingTree, gitInit, gitStage, gitUnstage, gitDiscard, gitCommit,
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
    expect(screen.getByText('分支 main')).toBeTruthy()
    expect(screen.getByPlaceholderText('提交说明')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '提交' }).disabled).toBe(true)
    expect(screen.getByText('选择一个文件以查看差异')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '初始化仓库' })).toBeNull()
  })

  it('default: binds the Session Workspace, lists both sides, and shows a detached HEAD', async () => {
    const b = mount({ tree: DIRTY_REPO })
    await waitFor(() => { expect(screen.getAllByText('src/a.ts').length).toBe(2) })
    expect(b.gitWorkingTree).toHaveBeenCalledWith(WID, expect.any(AbortSignal))
    expect(screen.getByText('分支 HEAD detached at abc1234')).toBeTruthy()
    expect(screen.getByText('更改')).toBeTruthy()
    expect(screen.getByText('暂存的更改')).toBeTruthy()
    expect(screen.getAllByText('src/a.ts')).toHaveLength(2)
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.getByText('docs/note.md')).toBeTruthy()
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
    expect(screen.getByText('分支 topic')).toBeTruthy()
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

  function rowOf(path: string): HTMLElement {
    return screen.getByText(path).closest('li')!
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
    await waitFor(() => { expect(screen.getByText('docs/note.md')).toBeTruthy() })
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
    const gitUnstage = vi.fn(async () => ({
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
})
