import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, unlinkSync, writeFileSync, existsSync } from 'node:fs'
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
  return { rpcId: RpcId(`git-write-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

function requireHunkHeader(header: string | undefined): string {
  expect(header).toBeDefined()
  if (header === undefined) throw new Error('unreachable')
  return header
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
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-git-write-'))),
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

describe('host.gitStage', () => {
  it('moves an unstaged tracked path into staged changes without rewriting disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const staged = expectOk(await api.host.gitStage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
      new AbortController().signal,
    ))

    expect(staged).toMatchObject({
      availability: 'repository',
      unstaged: [],
      staged: [{ path: 'tracked.txt', absolutePath: join(workspace.path, 'tracked.txt') }],
    })
    expect(readFileSync(join(workspacePath, 'tracked.txt'), 'utf8')).toBe('v2\n')
  })
})

describe('host.gitUnstage', () => {
  it('returns a staged path to the unstaged list without rewriting disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitUnstage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [{ path: 'tracked.txt', absolutePath: join(workspace.path, 'tracked.txt') }],
      staged: [],
    })
    expect(readFileSync(join(workspacePath, 'tracked.txt'), 'utf8')).toBe('v2\n')
  })

  it('unstages an added path in an unborn repository without rewriting disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    writeFileSync(join(workspacePath, 'nangeai.md'), 'draft\n')
    execSync('git add nangeai.md', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitUnstage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'nangeai.md') }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [{ path: 'nangeai.md', absolutePath: join(workspace.path, 'nangeai.md'), kind: 'untracked' }],
      staged: [],
    })
    expect(readFileSync(join(workspacePath, 'nangeai.md'), 'utf8')).toBe('draft\n')
  })

  it('unstages an added path whose worktree diverged before the first commit', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    writeFileSync(join(workspacePath, 'nangeai.md'), 'draft\n')
    execSync('git add nangeai.md', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'nangeai.md'), 'edited\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitUnstage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'nangeai.md') }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [{ path: 'nangeai.md', kind: 'untracked' }],
      staged: [],
    })
    expect(readFileSync(join(workspacePath, 'nangeai.md'), 'utf8')).toBe('edited\n')
  })
})

describe('host.gitDiscard', () => {
  it('restores a tracked unstaged modification to the index contents on disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitDiscard(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [],
      staged: [],
    })
    expect(readFileSync(join(workspacePath, 'tracked.txt'), 'utf8')).toBe('v1\n')
  })

  it('deletes an untracked path from disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'keep\n', 'init')
    writeFileSync(join(workspacePath, 'scratch.txt'), 'temp\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitDiscard(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'scratch.txt') }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({ availability: 'repository', unstaged: [], staged: [] })
    expect(existsSync(join(workspacePath, 'scratch.txt'))).toBe(false)
  })

  it('restores a tracked deletion onto disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'gone.txt', 'back\n', 'init')
    unlinkSync(join(workspacePath, 'gone.txt'))

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitDiscard(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'gone.txt') }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({ availability: 'repository', unstaged: [], staged: [] })
    expect(readFileSync(join(workspacePath, 'gone.txt'), 'utf8')).toBe('back\n')
  })

  it('refuses to discard a staged-only path so discard never acts on the index', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'ready.txt'), 'staged\n')
    execSync('git add ready.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitDiscard(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'ready.txt') }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-path-not-found', details: { path: join(workspace.path, 'ready.txt') } },
    })
    expect(readFileSync(join(workspacePath, 'ready.txt'), 'utf8')).toBe('staged\n')
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree).toMatchObject({
      availability: 'repository',
      staged: [{ path: 'ready.txt' }],
    })
  })
})

describe('host.gitStage hunk', () => {
  it('stages only the requested hunk so the path appears in both change lists', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'lines.txt', 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n', 'init')
    writeFileSync(join(workspacePath, 'lines.txt'), 'A\nb\nc\nd\ne\nf\ng\nh\ni\nJ\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'lines.txt')
    const preview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'unstaged' as const }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    expect(preview.hunks.length).toBeGreaterThanOrEqual(2)
    const firstHunk = requireHunkHeader(preview.hunks[0]?.header)

    const tree = expectOk(await api.host.gitStage(
      request({ workspaceId: workspace.workspaceId, path, hunkHeader: firstHunk }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [{ path: 'lines.txt' }],
      staged: [{ path: 'lines.txt' }],
    })

    const unstagedPreview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'unstaged' as const }),
      new AbortController().signal,
    ))
    const stagedPreview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'staged' as const }),
      new AbortController().signal,
    ))
    expect(unstagedPreview.kind).toBe('text')
    expect(stagedPreview.kind).toBe('text')
    if (unstagedPreview.kind !== 'text' || stagedPreview.kind !== 'text') throw new Error('unreachable')
    expect(stagedPreview.hunks).toEqual([preview.hunks[0]])
    expect(unstagedPreview.hunks.map(hunk => hunk.header)).not.toContain(firstHunk)
  })
})

describe('host.gitUnstage hunk', () => {
  it('unstages only the requested hunk without rewriting disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'lines.txt', 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n', 'init')
    writeFileSync(join(workspacePath, 'lines.txt'), 'A\nb\nc\nd\ne\nf\ng\nh\ni\nJ\n')
    execSync('git add lines.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'lines.txt')
    const preview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'staged' as const }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    expect(preview.hunks.length).toBeGreaterThanOrEqual(2)
    const firstHunk = requireHunkHeader(preview.hunks[0]?.header)
    const secondHunk = requireHunkHeader(preview.hunks[1]?.header)

    const tree = expectOk(await api.host.gitUnstage(
      request({ workspaceId: workspace.workspaceId, path, hunkHeader: firstHunk }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [{ path: 'lines.txt' }],
      staged: [{ path: 'lines.txt' }],
    })
    expect(readFileSync(join(workspacePath, 'lines.txt'), 'utf8')).toBe('A\nb\nc\nd\ne\nf\ng\nh\ni\nJ\n')

    const stagedPreview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'staged' as const }),
      new AbortController().signal,
    ))
    expect(stagedPreview.kind).toBe('text')
    if (stagedPreview.kind !== 'text') throw new Error('unreachable')
    expect(stagedPreview.hunks.map(hunk => hunk.header)).not.toContain(firstHunk)
    expect(stagedPreview.hunks.map(hunk => hunk.header)).toContain(secondHunk)
  })
})

describe('host.gitDiscard hunk', () => {
  it('discards only the requested unstaged hunk on disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'lines.txt', 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n', 'init')
    writeFileSync(join(workspacePath, 'lines.txt'), 'A\nb\nc\nd\ne\nf\ng\nh\ni\nJ\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'lines.txt')
    const preview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'unstaged' as const }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    expect(preview.hunks.length).toBeGreaterThanOrEqual(2)
    const firstHunk = requireHunkHeader(preview.hunks[0]?.header)

    const tree = expectOk(await api.host.gitDiscard(
      request({ workspaceId: workspace.workspaceId, path, hunkHeader: firstHunk }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [{ path: 'lines.txt' }],
      staged: [],
    })
    expect(readFileSync(join(workspacePath, 'lines.txt'), 'utf8')).toBe('a\nb\nc\nd\ne\nf\ng\nh\ni\nJ\n')
  })
})

describe('host.gitCommit', () => {
  it('creates a new HEAD commit from a non-empty staged area and message', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    const parent = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitCommit(
      request({ workspaceId: workspace.workspaceId, message: 'update tracked' }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      branch: 'main',
      unstaged: [],
      staged: [],
    })
    const log = execSync('git log -1 --format=%H%n%P%n%B', { cwd: workspacePath, encoding: 'utf8' })
    const [hash, parents, body] = log.trim().split('\n')
    expect(hash).not.toBe(parent)
    expect(parents).toBe(parent)
    expect(body).toBe('update tracked')
    expect(execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe(hash)
  })

  it('allows an empty commit message when the staged area is non-empty', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    const parent = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitCommit(
      request({ workspaceId: workspace.workspaceId, message: '   \n' }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({ availability: 'repository', staged: [], unstaged: [] })
    const log = execSync('git log -1 --format=%H%n%P%n%B', { cwd: workspacePath, encoding: 'utf8' })
    const [hash, parents, ...bodyLines] = log.trimEnd().split('\n')
    const body = bodyLines.join('\n')
    expect(hash).not.toBe(parent)
    expect(parents).toBe(parent)
    expect(body).toBe('')
  })

  it('pushes to the configured remote when push is true and upstream is set', async () => {
    const { api, root } = await harness()
    const barePath = join(root, 'origin.git')
    mkdirSync(barePath)
    execSync('git init --bare -b main', { cwd: barePath, stdio: 'ignore' })

    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync(`git remote add origin ${barePath}`, { cwd: workspacePath, stdio: 'ignore' })
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    execSync('git push -u origin main', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitCommit(
      request({ workspaceId: workspace.workspaceId, message: 'update tracked', push: true }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({ availability: 'repository', staged: [], unstaged: [] })
    const remoteHead = execSync('git rev-parse main', { cwd: barePath, encoding: 'utf8' }).trim()
    const localHead = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    expect(remoteHead).toBe(localHead)
  })

  it('sets upstream on first push when the branch has no upstream', async () => {
    const { api, root } = await harness()
    const barePath = join(root, 'origin.git')
    mkdirSync(barePath)
    execSync('git init --bare -b main', { cwd: barePath, stdio: 'ignore' })

    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync(`git remote add origin ${barePath}`, { cwd: workspacePath, stdio: 'ignore' })
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    expectOk(await api.host.gitCommit(
      request({ workspaceId: workspace.workspaceId, message: 'first push', push: true }),
      new AbortController().signal,
    ))

    const upstream = execSync('git rev-parse @{u}', { cwd: workspacePath, encoding: 'utf8' }).trim()
    const localHead = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    expect(upstream).toBe(localHead)
    const remoteHead = execSync('git rev-parse main', { cwd: barePath, encoding: 'utf8' }).trim()
    expect(remoteHead).toBe(localHead)
  })

  it('reports ahead commits on gitWorkingTree', async () => {
    const { api, root } = await harness()
    const barePath = join(root, 'origin.git')
    mkdirSync(barePath)
    execSync('git init --bare -b main', { cwd: barePath, stdio: 'ignore' })

    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync(`git remote add origin ${barePath}`, { cwd: workspacePath, stdio: 'ignore' })
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    execSync('git push -u origin main', { cwd: workspacePath, stdio: 'ignore' })
    commitFile(workspacePath, 'tracked.txt', 'v2\n', 'local only')
    commitFile(workspacePath, 'tracked.txt', 'v3\n', 'local only 2')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({
      availability: 'repository',
      ahead: 2,
      pushAvailable: true,
      hasRemote: true,
      staged: [],
    })
  })

  it('pushes existing commits without creating a new one', async () => {
    const { api, root } = await harness()
    const barePath = join(root, 'origin.git')
    mkdirSync(barePath)
    execSync('git init --bare -b main', { cwd: barePath, stdio: 'ignore' })

    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync(`git remote add origin ${barePath}`, { cwd: workspacePath, stdio: 'ignore' })
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    execSync('git push -u origin main', { cwd: workspacePath, stdio: 'ignore' })
    commitFile(workspacePath, 'tracked.txt', 'v2\n', 'local only')
    commitFile(workspacePath, 'tracked.txt', 'v3\n', 'local only 2')
    const parentCount = Number(execSync('git rev-list --count HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim())

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitPush(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(tree).toMatchObject({ availability: 'repository', pushAvailable: false })
    expect(Number(execSync('git rev-list --count HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim())).toBe(parentCount)
    const remoteHead = execSync('git rev-parse main', { cwd: barePath, encoding: 'utf8' }).trim()
    const localHead = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    expect(remoteHead).toBe(localHead)
  })

  it('refuses push when the repository has no remotes', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    const head = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitPush(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-failed', message: 'no remote configured' },
    })
    expect(execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe(head)
  })

  it('reports a rejected first push without the To-url destination line as the message', async () => {
    const { api, root } = await harness()
    const barePath = join(root, 'origin.git')
    mkdirSync(barePath)
    execSync('git init --bare -b main', { cwd: barePath, stdio: 'ignore' })

    const seedPath = join(root, 'seed')
    mkdirSync(seedPath)
    initGitRepo(seedPath)
    execSync(`git remote add origin ${barePath}`, { cwd: seedPath, stdio: 'ignore' })
    commitFile(seedPath, 'README.md', 'remote\n', 'readme')
    execSync('git push -u origin main', { cwd: seedPath, stdio: 'ignore' })

    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync(`git remote add origin ${barePath}`, { cwd: workspacePath, stdio: 'ignore' })
    commitFile(workspacePath, 'local.txt', 'local\n', 'init')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitPush(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({ ok: false, error: { code: 'git-failed' } })
    if (response.result.ok) throw new Error('unreachable')
    expect(response.result.error.message).not.toMatch(/^To /)
    expect(response.result.error.message).toMatch(/\[rejected]|non-fast-forward|fetch first/)
  })

  it('refuses commit-and-push when the repository has no remotes and does not create the commit', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    const parent = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitCommit(
      request({ workspaceId: workspace.workspaceId, message: 'should not land', push: true }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-failed', message: 'no remote configured' },
    })
    expect(execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe(parent)
    expect(execSync('git diff --cached --name-only', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe('tracked.txt')
  })

  it('adds origin and reports hasRemote on the refreshed tree', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const before = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(before).toMatchObject({ availability: 'repository', hasRemote: false })

    const tree = expectOk(await api.host.gitAddRemote(
      request({ workspaceId: workspace.workspaceId, url: 'https://example.com/org/repo.git' }),
      new AbortController().signal,
    ))
    expect(tree).toMatchObject({
      availability: 'repository',
      hasRemote: true,
      originUrl: 'https://example.com/org/repo.git',
      pushAvailable: true,
    })
    expect(execSync('git remote get-url origin', { cwd: workspacePath, encoding: 'utf8' }).trim())
      .toBe('https://example.com/org/repo.git')
  })

  it('does not offer first-time push after adding origin when HEAD has no commits', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitAddRemote(
      request({ workspaceId: workspace.workspaceId, url: 'https://example.com/org/repo.git' }),
      new AbortController().signal,
    ))
    expect(tree).toMatchObject({
      availability: 'repository',
      hasRemote: true,
      originUrl: 'https://example.com/org/repo.git',
      pushAvailable: false,
    })
  })

  it('refuses an empty or newline remote URL without creating origin', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    for (const url of ['', '   ', 'https://example.com\n/repo.git', 'https://example.com\r/repo.git', 'https://example.com/repo.git\0']) {
      const response = await api.host.gitAddRemote(
        request({ workspaceId: workspace.workspaceId, url }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'empty remote url' },
      })
    }
    expect(execSync('git remote', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe('')
  })

  it('refuses gitAddRemote when origin already exists', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync('git remote add origin https://example.com/org/repo.git', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitAddRemote(
      request({ workspaceId: workspace.workspaceId, url: 'https://example.com/other.git' }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-failed' },
    })
    expect(execSync('git remote get-url origin', { cwd: workspacePath, encoding: 'utf8' }).trim())
      .toBe('https://example.com/org/repo.git')
  })

  it('removes origin and omits originUrl on the refreshed tree', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync('git remote add origin https://example.com/org/repo.git', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const before = expectOk(await api.host.gitWorkingTree(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(before).toMatchObject({
      availability: 'repository',
      hasRemote: true,
      originUrl: 'https://example.com/org/repo.git',
    })

    const tree = expectOk(await api.host.gitRemoveRemote(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree).toMatchObject({ availability: 'repository', hasRemote: false })
    expect(tree).not.toHaveProperty('originUrl')
    expect(execSync('git remote', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe('')
  })

  it('leaves other remotes when removing origin', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    execSync('git remote add origin https://example.com/org/repo.git', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git remote add upstream https://example.com/org/up.git', { cwd: workspacePath, stdio: 'ignore' })

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitRemoveRemote(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))
    expect(tree).toMatchObject({ availability: 'repository', hasRemote: true })
    expect(tree).not.toHaveProperty('originUrl')
    expect(execSync('git remote', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe('upstream')
  })

  it('refuses gitRemoveRemote when origin is missing', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitRemoveRemote(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-failed' },
    })
  })

  it('rejects commit when the staged area is empty', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    const parent = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitCommit(
      request({ workspaceId: workspace.workspaceId, message: 'should not land' }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-failed', message: 'nothing to commit' },
    })
    expect(execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf8' }).trim()).toBe(parent)
    expect(readFileSync(join(workspacePath, 'tracked.txt'), 'utf8')).toBe('v2\n')
  })

  it('returns Git\'s author-identity failure without substituting a Session user', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })

    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (command, args, signal) => {
      if (command === 'git' && args.includes('commit')) {
        throw Object.assign(new Error('Author identity unknown'), {
          stderr: 'Author identity unknown\n\n*** Please tell me who you are.\nfatal: unable to auto-detect email address (got \'user@host.\')\n',
        })
      }
      return original(command, args, signal)
    })
    try {
      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const response = await api.host.gitCommit(
        request({ workspaceId: workspace.workspaceId, message: 'needs identity' }),
        new AbortController().signal,
      )
      expect(response.result.ok).toBe(false)
      if (response.result.ok) throw new Error('unreachable')
      expect(response.result.error.code).toBe('git-failed')
      expect(response.result.error.message).toMatch(/Author identity unknown/)
    } finally {
      runSpy.mockRestore()
    }
  })
})

describe('host Git write RPC set', () => {
  it('does not expose an arbitrary git argv channel', async () => {
    const { api } = await harness()
    expect(api.host).not.toHaveProperty('gitRun')
    expect(api.host).not.toHaveProperty('git')
  })

  it('stages an untracked file into the staged list', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'keep\n', 'init')
    writeFileSync(join(workspacePath, 'new.txt'), 'fresh\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const tree = expectOk(await api.host.gitStage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'new.txt') }),
      new AbortController().signal,
    ))
    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [],
      staged: [{ path: 'new.txt' }],
    })
    expect(readFileSync(join(workspacePath, 'new.txt'), 'utf8')).toBe('fresh\n')
  })

  it('fails write RPCs with workspace-not-found for an unknown workspace', async () => {
    const { api } = await harness()
    const missing = 'missing' as WorkspaceId
    const path = '/tmp/x'
    for (const response of [
      await api.host.gitStage(request({ workspaceId: missing, path }), new AbortController().signal),
      await api.host.gitUnstage(request({ workspaceId: missing, path }), new AbortController().signal),
      await api.host.gitDiscard(request({ workspaceId: missing, path }), new AbortController().signal),
      await api.host.gitCommit(request({ workspaceId: missing, message: 'x' }), new AbortController().signal),
      await api.host.gitAddRemote(
        request({ workspaceId: missing, url: 'https://example.com/repo.git' }),
        new AbortController().signal,
      ),
      await api.host.gitRemoveRemote(request({ workspaceId: missing }), new AbortController().signal),
    ]) {
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
      })
    }
  })

  it('fails staging a path that is not an unstaged change', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'clean.txt', 'ok\n', 'init')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitStage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'clean.txt') }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-path-not-found' },
    })
  })

  it('fails hunk staging when the hunk header is not in the unstaged diff', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitStage(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'tracked.txt'),
        hunkHeader: '@@ -99,1 +99,1 @@',
      }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-path-not-found' },
    })
  })

  it('fails hunk staging of an untracked file', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'keep\n', 'init')
    writeFileSync(join(workspacePath, 'new.txt'), 'fresh\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitStage(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'new.txt'),
        hunkHeader: '@@ -0,0 +1,1 @@',
      }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'git-path-not-found' },
    })
  })

  it('fails write RPCs with git-unavailable when git is missing', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }),
    )
    try {
      const response = await api.host.gitStage(
        request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'git-unavailable' } })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports cancelled when the caller aborts a write RPC', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'x')
    const writers = [
      (signal: AbortSignal) => api.host.gitStage(request({ workspaceId: workspace.workspaceId, path }), signal),
      (signal: AbortSignal) => api.host.gitUnstage(request({ workspaceId: workspace.workspaceId, path }), signal),
      (signal: AbortSignal) => api.host.gitDiscard(request({ workspaceId: workspace.workspaceId, path }), signal),
      (signal: AbortSignal) => api.host.gitCommit(request({ workspaceId: workspace.workspaceId, message: 'x' }), signal),
    ]
    for (const write of writers) {
      const ac = new AbortController()
      const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async () => {
        ac.abort()
        throw new Error('aborted')
      })
      try {
        const response = await write(ac.signal)
        expect(response.result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
      } finally {
        runSpy.mockRestore()
      }
    }
  })

  it('fails hunk apply with git-failed when Git rejects the patch', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'lines.txt', 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n', 'init')
    writeFileSync(join(workspacePath, 'lines.txt'), 'A\nb\nc\nd\ne\nf\ng\nh\ni\nJ\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'lines.txt')
    const preview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'unstaged' as const }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (command, args, signal) => {
      if (command === 'git' && args.includes('apply')) {
        throw Object.assign(new Error('patch failed'), { stderr: 'error: patch failed: lines.txt:1' })
      }
      return original(command, args, signal)
    })
    try {
      const response = await api.host.gitStage(
        request({
          workspaceId: workspace.workspaceId,
          path,
          hunkHeader: requireHunkHeader(preview.hunks[0]?.header),
        }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'error: patch failed: lines.txt:1' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('fails unstaging and discarding when the hunk header is absent', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v3\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'tracked.txt')
    const missing = '@@ -99,1 +99,1 @@'
    const unstage = await api.host.gitUnstage(
      request({ workspaceId: workspace.workspaceId, path, hunkHeader: missing }),
      new AbortController().signal,
    )
    const discard = await api.host.gitDiscard(
      request({ workspaceId: workspace.workspaceId, path, hunkHeader: missing }),
      new AbortController().signal,
    )
    expect(unstage.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
    expect(discard.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
  })

  it('fails hunk discard of an untracked file', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'keep\n', 'init')
    writeFileSync(join(workspacePath, 'new.txt'), 'fresh\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitDiscard(
      request({
        workspaceId: workspace.workspaceId,
        path: join(workspace.path, 'new.txt'),
        hunkHeader: '@@ -0,0 +1,1 @@',
      }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
  })

  it('fails write RPCs when the bound Workspace is not a repository', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'plain')
    mkdirSync(workspacePath)
    writeFileSync(join(workspacePath, 'note.txt'), 'x\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'note.txt')
    for (const response of [
      await api.host.gitStage(request({ workspaceId: workspace.workspaceId, path }), new AbortController().signal),
      await api.host.gitUnstage(request({ workspaceId: workspace.workspaceId, path }), new AbortController().signal),
      await api.host.gitDiscard(request({ workspaceId: workspace.workspaceId, path }), new AbortController().signal),
      await api.host.gitCommit(request({ workspaceId: workspace.workspaceId, message: 'x' }), new AbortController().signal),
    ]) {
      expect(response.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
    }
  })

  it('fails staging when git rev-parse fails for a reason other than missing git or not a repository', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (command, args, signal) => {
      if (command === 'git' && args.includes('rev-parse')) {
        throw Object.assign(new Error('fatal: bad object HEAD'), { stderr: 'fatal: bad object HEAD\n' })
      }
      return original(command, args, signal)
    })
    try {
      const response = await api.host.gitStage(
        request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({
        ok: false,
        error: { code: 'git-failed', message: 'fatal: bad object HEAD' },
      })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('refuses to unstage a path that is not in the staged list', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.gitUnstage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
    expect(readFileSync(join(workspacePath, 'tracked.txt'), 'utf8')).toBe('v2\n')
    const clean = await api.host.gitUnstage(
      request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'missing.txt') }),
      new AbortController().signal,
    )
    expect(clean.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
  })

  it('stages a single-hunk tracked change without rewriting disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const path = join(workspace.path, 'tracked.txt')
    const preview = expectOk(await api.host.gitDiffPreview(
      request({ workspaceId: workspace.workspaceId, path, side: 'unstaged' as const }),
      new AbortController().signal,
    ))
    expect(preview.kind).toBe('text')
    if (preview.kind !== 'text') throw new Error('unreachable')
    const tree = expectOk(await api.host.gitStage(
      request({
        workspaceId: workspace.workspaceId,
        path,
        hunkHeader: requireHunkHeader(preview.hunks[0]?.header),
      }),
      new AbortController().signal,
    ))
    expect(tree).toMatchObject({
      availability: 'repository',
      unstaged: [],
      staged: [{ path: 'tracked.txt' }],
    })
    expect(readFileSync(join(workspacePath, 'tracked.txt'), 'utf8')).toBe('v2\n')
  })

  it('fails with git-unavailable when git disappears after the repository is discovered', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (command, args, signal) => {
      if (command === 'git' && args.includes('status')) {
        throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
      }
      return original(command, args, signal)
    })
    try {
      const response = await api.host.gitStage(
        request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'git-unavailable' } })
    } finally {
      runSpy.mockRestore()
    }
  })

  it('fails with git-path-not-found when git reports not-a-repository after discovery', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    commitFile(workspacePath, 'tracked.txt', 'v1\n', 'init')
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2\n')
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const original = nativeCommand.runNativeCommand
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockImplementation(async (command, args, signal) => {
      if (command === 'git' && args.includes('status')) {
        throw Object.assign(new Error('fatal: not a git repository'), {
          stderr: 'fatal: not a git repository (or any of the parent directories): .git\n',
        })
      }
      return original(command, args, signal)
    })
    try {
      const response = await api.host.gitStage(
        request({ workspaceId: workspace.workspaceId, path: join(workspace.path, 'tracked.txt') }),
        new AbortController().signal,
      )
      expect(response.result).toMatchObject({ ok: false, error: { code: 'git-path-not-found' } })
    } finally {
      runSpy.mockRestore()
    }
  })
})
