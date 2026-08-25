import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import * as nativeCommand from '@deepseek-ai/dsh-native-command'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`git-working-tree-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

function stubAgent(session: Session): Agent {
  return {
    id: session.id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

async function harness(
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-git-working-tree-'))),
) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend())
  const storageDomain = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', storageDomain)
  ctx.provide('storageDomain', storageDomain)
  ctx.provide('sessionPersistence', { list: () => Promise.resolve([]) } as never)
  await ctx.plugin(WorkspaceRegistry)

  const factory: AgentFactory = {
    async createAgent(_ownerCtx, options) {
      const session = ctx.sessions.create(
        options.sessionId,
        options.meta === undefined ? {} : { meta: options.meta },
      )
      const agent = stubAgent(session)
      const unregister = ctx.agents.register(agent)
      return {
        agent,
        dispose: () => {
          unregister()
          return Promise.resolve()
        },
      }
    },
    async resume() {
      throw new Error('test harness has no persisted sessions')
    },
  }
  ctx.agents.setFactory(factory)
  ctx.provide('directoryPicker', { capability: () => ({ kind: 'native', pick: async () => null }) } as never)
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }),
    cwd: root,
  })
  return { api, root }
}

function initGitRepo(dir: string): void {
  execSync('git init -b main', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.name "Test User"', { cwd: dir, stdio: 'ignore' })
}

function commitFile(dir: string, name: string, contents: string, message: string): void {
  writeFileSync(join(dir, name), contents)
  execSync(`git add ${name}`, { cwd: dir, stdio: 'ignore' })
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'ignore' })
}

describe('host.gitWorkingTree', () => {
  it('discovers the repository root and current branch from a bound Workspace', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'readme.txt', 'hello', 'init')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(tree).toEqual({
      availability: 'repository',
      repoRoot: workspace.path,
      branch: 'main',
      unstaged: [],
      staged: [],
    })
  })

  it('walks upward from a nested bound Workspace to the Git repository root', async () => {
    const { api, root } = await harness()
    const repoRoot = join(root, 'repo')
    const workspacePath = join(repoRoot, 'packages', 'app')
    mkdirSync(workspacePath, { recursive: true })
    initGitRepo(repoRoot)
    commitFile(repoRoot, 'readme.txt', 'hello', 'init')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      repoRoot: realpathSync.native(repoRoot),
      branch: 'main',
    })
  })

  it('returns Git\'s detached HEAD description when there is no current branch', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'readme.txt', 'hello', 'init')
    const sha = execSync('git rev-parse --short HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    execSync('git checkout --detach HEAD', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      branch: `HEAD detached at ${sha}`,
    })
  })

  it('splits unstaged and staged changes and omits ignored paths', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1', 'init')
    writeFileSync(join(workspacePath, '.gitignore'), 'ignored.txt\n')
    execSync('git add .gitignore', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "ignore"', { cwd: workspacePath, stdio: 'ignore' })

    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2')
    writeFileSync(join(workspacePath, 'untracked.txt'), 'new')
    writeFileSync(join(workspacePath, 'ignored.txt'), 'secret')

    writeFileSync(join(workspacePath, 'removed.txt'), 'gone')
    execSync('git add removed.txt', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "add removed"', { cwd: workspacePath, stdio: 'ignore' })
    unlinkSync(join(workspacePath, 'removed.txt'))

    writeFileSync(join(workspacePath, 'staged.txt'), 'ready')
    execSync('git add staged.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(tree.availability).toBe('repository')
    if (tree.availability !== 'repository') throw new Error('unreachable')
    expect(tree.unstaged).toEqual([
      { path: 'removed.txt', absolutePath: join(workspace.path, 'removed.txt'), kind: 'deleted' },
      { path: 'tracked.txt', absolutePath: join(workspace.path, 'tracked.txt'), kind: 'modified' },
      { path: 'untracked.txt', absolutePath: join(workspace.path, 'untracked.txt'), kind: 'untracked' },
    ])
    expect(tree.staged).toEqual([
      { path: 'staged.txt', absolutePath: join(workspace.path, 'staged.txt'), kind: 'untracked' },
    ])
  })

  it('lists the same path in both segments when only part of its diff is staged', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'partial.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'partial.txt'), 'v2\n')
    execSync('git add partial.txt', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'partial.txt'), 'v3\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree.availability).toBe('repository')
    if (tree.availability !== 'repository') throw new Error('unreachable')
    const row = { path: 'partial.txt', absolutePath: join(workspace.path, 'partial.txt'), kind: 'modified' as const }
    expect(tree.unstaged).toEqual([row])
    expect(tree.staged).toEqual([row])
  })

  it('includes repo-relative paths that lie outside the bound Workspace', async () => {
    const { api, root } = await harness()
    const repoRoot = join(root, 'repo')
    const workspacePath = join(repoRoot, 'packages', 'app')
    mkdirSync(workspacePath, { recursive: true })
    initGitRepo(repoRoot)
    commitFile(repoRoot, 'outside.txt', 'v1', 'init')
    writeFileSync(join(repoRoot, 'outside.txt'), 'v2')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree.availability).toBe('repository')
    if (tree.availability !== 'repository') throw new Error('unreachable')
    expect(tree.repoRoot).toBe(realpathSync.native(repoRoot))
    expect(tree.unstaged).toEqual([
      {
        path: 'outside.txt',
        absolutePath: join(realpathSync.native(repoRoot), 'outside.txt'),
        kind: 'modified',
      },
    ])
  })

  it('distinguishes a missing git binary from a directory that is not a Git repository', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'plain')
    mkdirSync(workspacePath)
    writeFileSync(join(workspacePath, 'readme.txt'), 'hello')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const missingRepo = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(missingRepo).toEqual({ availability: 'not-a-repository' })

    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }),
    )
    try {
      const unavailable = expectOk(await api.host.gitWorkingTree(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      ))
      expect(unavailable).toEqual({ availability: 'git-unavailable' })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports workspace-not-found for an unknown workspace id', async () => {
    const { api } = await harness()
    const response = await api.host.gitWorkingTree(
      request({ workspaceId: 'missing' as WorkspaceId }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
    })
  })

  it('reports git-unavailable even when a .git directory is already on disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }),
    )
    try {
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const tree = expectOk(await api.host.gitWorkingTree(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      ))
      expect(tree).toEqual({ availability: 'git-unavailable' })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('sorts staged paths and lists two staged files', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'keep.txt', 'ok\n', 'init')
    writeFileSync(join(workspacePath, 'z-late.txt'), 'z\n')
    writeFileSync(join(workspacePath, 'a-early.txt'), 'a\n')
    execSync('git add z-late.txt a-early.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree.availability).toBe('repository')
    if (tree.availability !== 'repository') throw new Error('unreachable')
    expect(tree.staged).toEqual([
      { path: 'a-early.txt', absolutePath: join(workspace.path, 'a-early.txt'), kind: 'untracked' },
      { path: 'z-late.txt', absolutePath: join(workspace.path, 'z-late.txt'), kind: 'untracked' },
    ])
  })

  it('maps unexpected git failures to an internal error', async () => {
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('lock'), { stderr: 'fatal: Unable to create index.lock' }),
    )
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitWorkingTree(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'internal', message: 'lock' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports cancelled when the caller aborts git working-tree inspection', async () => {
    const ac = new AbortController()
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async () => {
      ac.abort()
      throw new Error('aborted')
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitWorkingTree(
        request({ workspaceId: workspace.workspaceId }),
        ac.signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('treats non-Error git rejections whose stderr says the directory is not a repository', async () => {
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue({
      stderr: 'fatal: Not a git repository',
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const tree = expectOk(await api.host.gitWorkingTree(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      ))
      expect(tree).toEqual({ availability: 'not-a-repository' })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('treats Error git rejections without stderr whose message says not a git repo', async () => {
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      new Error('fatal: not a git repo'),
    )
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const tree = expectOk(await api.host.gitWorkingTree(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      ))
      expect(tree).toEqual({ availability: 'not-a-repository' })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports cancelled when the caller aborts while reading the current branch', async () => {
    const ac = new AbortController()
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (file, args, signal) => {
      if (args.includes('symbolic-ref')) {
        ac.abort()
        throw new Error('aborted')
      }
      return original(file, args, signal)
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'repo')
      mkdirSync(workspacePath)
      initGitRepo(workspacePath)
      commitFile(workspacePath, 'readme.txt', 'hello', 'init')
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitWorkingTree(
        request({ workspaceId: workspace.workspaceId }),
        ac.signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    } finally {
      runSpy.mockRestore()
    }
  })
})

describe('host.gitInit', () => {
  it('initializes a Git repository at the bound Workspace root when no ancestor repository exists', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'plain')
    mkdirSync(workspacePath)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const inited = expectOk(await api.host.gitInit(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(inited).toEqual({ repoRoot: workspace.path })

    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree.availability).toBe('repository')
    if (tree.availability !== 'repository') throw new Error('unreachable')
    expect(tree.repoRoot).toBe(workspace.path)
    expect(tree.unstaged).toEqual([])
    expect(tree.staged).toEqual([])
  })

  it('refuses to initialize when an ancestor Git repository already exists', async () => {
    const { api, root } = await harness()
    const repoRoot = join(root, 'repo')
    const workspacePath = join(repoRoot, 'packages', 'app')
    mkdirSync(workspacePath, { recursive: true })
    initGitRepo(repoRoot)
    commitFile(repoRoot, 'readme.txt', 'hello', 'init')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitInit(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'already-a-git-repository',
        details: { repoRoot: realpathSync.native(repoRoot) },
      },
    })
  })

  it('fails initialization with git-unavailable when git is missing', async () => {
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }),
    )
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-unavailable' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('fails initialization with git-failed when rev-parse fails for a reason other than missing git or missing repo', async () => {
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('lock'), { stderr: 'fatal: Unable to create index.lock' }),
    )
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'fatal: Unable to create index.lock' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('fails initialization with git-failed when git init itself fails', async () => {
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (file, args, options) => {
      if (args.includes('init')) {
        throw Object.assign(new Error('denied'), { stderr: 'could not create directory' })
      }
      return original(file, args, options)
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'could not create directory' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('uses the Error message when git init fails without stderr', async () => {
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (file, args, options) => {
      if (args.includes('init')) throw new Error('denied')
      return original(file, args, options)
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'denied' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports cancelled when the caller aborts git init', async () => {
    const ac = new AbortController()
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async () => {
      ac.abort()
      throw new Error('aborted')
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        ac.signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports workspace-not-found for an unknown workspace id', async () => {
    const { api } = await harness()
    const response = await api.host.gitInit(
      request({ workspaceId: 'missing' as WorkspaceId }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
    })
  })

  it('fails initialization with git-failed when git rejects with a non-Error value', async () => {
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (file, args, options) => {
      if (args.includes('init')) throw 'denied'
      return original(file, args, options)
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'denied' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports cancelled when git init is aborted after discovering there is no repository', async () => {
    const ac = new AbortController()
    let calls = 0
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        throw Object.assign(new Error('fatal: not a git repository'), {
          stderr: 'fatal: not a git repository',
        })
      }
      ac.abort()
      throw new Error('aborted')
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        ac.signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('fails initialization with git-unavailable when git disappears after the missing-repo probe', async () => {
    let calls = 0
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        throw Object.assign(new Error('fatal: not a git repository'), {
          stderr: 'fatal: not a git repository',
        })
      }
      throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitInit(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'git-unavailable' } })
    } finally {
      runSpy.mockRestore()
    }
  })
})

describe('host.gitDiffPreview', () => {
  it('returns line-level hunks for an unstaged tracked text change', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'note.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'note.txt'), 'v2\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'note.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    expect(preview.hunks.length).toBeGreaterThan(0)
    expect(preview.hunks.flatMap(hunk => hunk.lines)).toEqual(expect.arrayContaining([
      { origin: 'del', text: 'v1' },
      { origin: 'add', text: 'v2' },
    ]))
    expect(preview.fileText).toBe('v2\n')
  })

  it('previews untracked text as a whole-file addition', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'ok\n', 'init')
    writeFileSync(join(workspacePath, 'new.txt'), 'hello\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'new.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview).toEqual({ kind: 'untracked-text', text: 'hello\n' })
  })

  it('declares binary untracked files as having a diff without hunks', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'ok\n', 'init')
    writeFileSync(join(workspacePath, 'blob.bin'), Buffer.from([0, 1, 2, 255]))

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'blob.bin'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview).toEqual({ kind: 'binary' })
  })

  it('returns deleted text content for an unstaged tracked deletion', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'gone.txt', 'old body\n', 'init')
    unlinkSync(join(workspacePath, 'gone.txt'))

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'gone.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview).toEqual({ kind: 'deleted-text', text: 'old body\n' })
  })

  it('treats a merge-conflict file as a working-tree change with a text preview', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'conflict.txt', 'base\n', 'base')
    execSync('git checkout -b other', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'conflict.txt'), 'other\n')
    execSync('git add conflict.txt', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "other"', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git checkout main', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'conflict.txt'), 'main\n')
    execSync('git add conflict.txt', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "main"', { cwd: workspacePath, stdio: 'ignore' })
    try {
      execSync('git merge other', { cwd: workspacePath, stdio: 'ignore' })
    } catch {
      // merge conflict is the fixture
    }

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree.availability).toBe('repository')
    if (tree.availability !== 'repository') throw new Error('unreachable')
    expect(tree.unstaged).toEqual([
      { path: 'conflict.txt', absolutePath: join(workspace.path, 'conflict.txt'), kind: 'modified' },
    ])

    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'conflict.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
  })

  it('returns line-level hunks with context for a staged tracked text change', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'note.txt', 'keep-a\nchange-me\nkeep-b\n', 'init')
    writeFileSync(join(workspacePath, 'note.txt'), 'keep-a\nchanged\nkeep-b\n')
    execSync('git add note.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'note.txt'),
        side: 'staged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    expect(preview.hunks.flatMap(hunk => hunk.lines)).toEqual(expect.arrayContaining([
      { origin: 'context', text: 'keep-a' },
      { origin: 'del', text: 'change-me' },
      { origin: 'add', text: 'changed' },
      { origin: 'context', text: 'keep-b' },
    ]))
  })

  it('returns deleted text for a staged tracked deletion', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'gone.txt', 'old body\n', 'init')
    execSync('git rm gone.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'gone.txt'),
        side: 'staged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview).toEqual({ kind: 'deleted-text', text: 'old body\n' })
  })

  it('declares a tracked binary modification as a diff without hunks', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    writeFileSync(join(workspacePath, 'blob.bin'), Buffer.from([0, 1, 2, 255]))
    execSync('git add blob.bin', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "bin"', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'blob.bin'), Buffer.from([0, 9, 9, 255]))

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'blob.bin'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview).toEqual({ kind: 'binary' })
  })

  it('declares unstaged and staged binary deletions without hunks', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    writeFileSync(join(workspacePath, 'unstaged.bin'), Buffer.from([0, 1, 2]))
    writeFileSync(join(workspacePath, 'staged.bin'), Buffer.from([0, 3, 4]))
    execSync('git add unstaged.bin staged.bin', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "bins"', { cwd: workspacePath, stdio: 'ignore' })
    unlinkSync(join(workspacePath, 'unstaged.bin'))
    execSync('git rm staged.bin', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const unstaged = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'unstaged.bin'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(unstaged).toEqual({ kind: 'deleted-binary' })
    const staged = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'staged.bin'),
        side: 'staged' as const,
      }),
      new AbortController().signal,
    ))
    expect(staged).toEqual({ kind: 'deleted-binary' })
  })

  it('previews a staged binary modification without hunks', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    writeFileSync(join(workspacePath, 'blob.bin'), Buffer.from([0, 1, 2, 255]))
    execSync('git add blob.bin', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "bin"', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'blob.bin'), Buffer.from([0, 9, 9, 255]))
    execSync('git add blob.bin', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'blob.bin'),
        side: 'staged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview).toEqual({ kind: 'binary' })
  })

  it('reads deleted text from the index blob when a staged edit is then deleted on disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'gone.txt', 'committed\n', 'init')
    writeFileSync(join(workspacePath, 'gone.txt'), 'staged\n')
    execSync('git add gone.txt', { cwd: workspacePath, stdio: 'ignore' })
    unlinkSync(join(workspacePath, 'gone.txt'))

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'gone.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview).toEqual({ kind: 'deleted-text', text: 'staged\n' })
  })

  it('parses a unified diff that notes a missing trailing newline', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'note.txt', 'v1', 'init')
    writeFileSync(join(workspacePath, 'note.txt'), 'v2')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const preview = expectOk(await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'note.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    expect(preview.hunks.flatMap(hunk => hunk.lines)).toEqual(expect.arrayContaining([
      { origin: 'del', text: 'v1' },
      { origin: 'add', text: 'v2' },
    ]))
  })

  it('fails preview with git-path-not-found when the path is not a working-tree change', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'clean.txt', 'ok\n', 'init')
    writeFileSync(join(workspacePath, 'staged-only.txt'), 'ready\n')
    execSync('git add staged-only.txt', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'unstaged-only.txt'), 'disk\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const missing = await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'clean.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    )
    expect(missing.result).toMatchObject({
      ok: false,
      error: { code: 'git-path-not-found', details: { path: join(workspace.path, 'clean.txt') } },
    })

    const wrongSide = await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'staged-only.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    )
    expect(wrongSide.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })

    const unstagedAsStaged = await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'unstaged-only.txt'),
        side: 'staged' as const,
      }),
      new AbortController().signal,
    )
    expect(unstagedAsStaged.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })

    const outside = join(root, 'outside.txt')
    writeFileSync(outside, 'nope\n')
    const outOfRepo = await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: outside,
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    )
    expect(outOfRepo.result).toMatchObject({
      ok: false,
      error: { code: 'git-path-not-found', details: { path: outside } },
    })
  })

  it('fails preview with git-path-not-found when the bound Workspace is not a repository', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'plain')
    mkdirSync(workspacePath)
    writeFileSync(join(workspacePath, 'note.txt'), 'x\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitDiffPreview(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'note.txt'),
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
  })

  it('fails preview with git-unavailable when git is missing', async () => {
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }),
    )
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'repo')
      mkdirSync(workspacePath)
      initGitRepo(workspacePath)
      commitFile(workspacePath, 'note.txt', 'v1\n', 'init')
      writeFileSync(join(workspacePath, 'note.txt'), 'v2\n')
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitDiffPreview(
        request({
          workspaceId: workspace.workspaceId,
          path: join(workspace.path, 'note.txt'),
          side: 'unstaged' as const,
        }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'git-unavailable' } })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('fails preview with git-failed when a typed git invocation fails', async () => {
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (file, args, options) => {
      if (args.includes('diff')) {
        throw Object.assign(new Error('corrupt'), { stderr: 'fatal: corrupt index' })
      }
      return original(file, args, options)
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'repo')
      mkdirSync(workspacePath)
      initGitRepo(workspacePath)
      commitFile(workspacePath, 'note.txt', 'v1\n', 'init')
      writeFileSync(join(workspacePath, 'note.txt'), 'v2\n')
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitDiffPreview(
        request({
          workspaceId: workspace.workspaceId,
          path: join(workspace.path, 'note.txt'),
          side: 'unstaged' as const,
        }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'fatal: corrupt index' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports workspace-not-found for an unknown workspace id', async () => {
    const { api } = await harness()
    const response = await api.host.gitDiffPreview(
      request({
        workspaceId: 'missing' as WorkspaceId,
        path: '/tmp/x',
        side: 'unstaged' as const,
      }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
    })
  })

  it('reports cancelled when the caller aborts git diff preview', async () => {
    const ac = new AbortController()
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async () => {
      ac.abort()
      throw new Error('aborted')
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'plain')
      mkdirSync(workspacePath)
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitDiffPreview(
        request({
          workspaceId: workspace.workspaceId,
          path: join(workspace.path, 'note.txt'),
          side: 'unstaged' as const,
        }),
        ac.signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('ignores unrelated porcelain rows when matching the requested preview path', async () => {
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (file, args, signal) => {
      if (args.includes('status') && args.includes('--') && args.some(arg => arg.endsWith('note.txt'))) {
        return { stdout: ' M decoy.txt\n M note.txt\n', stderr: '' }
      }
      return original(file, args, signal)
    })
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'repo')
      mkdirSync(workspacePath)
      initGitRepo(workspacePath)
      commitFile(workspacePath, 'note.txt', 'v1\n', 'init')
      writeFileSync(join(workspacePath, 'note.txt'), 'v2\n')
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const preview = expectOk(await api.host.gitDiffPreview(
        request({
          workspaceId: workspace.workspaceId,
          path: join(workspace.path, 'note.txt'),
          side: 'unstaged' as const,
        }),
        new AbortController().signal,
      ))
      expect(preview.kind).toBe('text')
    } finally {
      runSpy.mockRestore()
    }
  })
})
