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
  return { rpcId: RpcId(`git-status-${String(nextRpc++)}`), payload }
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
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-git-status-'))),
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
  execSync('git init', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.name "Test User"', { cwd: dir, stdio: 'ignore' })
}

describe('host.gitStatus', () => {
  it('returns Client badge letters for modified, untracked, and deleted paths', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)

    writeFileSync(join(workspacePath, 'tracked.txt'), 'v1')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "init"', { cwd: workspacePath, stdio: 'ignore' })

    writeFileSync(join(workspacePath, 'tracked.txt'), 'v2')
    writeFileSync(join(workspacePath, 'new.txt'), 'new')

    writeFileSync(join(workspacePath, 'removed.txt'), 'gone')
    execSync('git add removed.txt', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "add removed"', { cwd: workspacePath, stdio: 'ignore' })
    unlinkSync(join(workspacePath, 'removed.txt'))

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const status = expectOk(await api.host.gitStatus(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(status.entries).toEqual(expect.arrayContaining([
      { path: join(workspace.path, 'tracked.txt'), letter: 'M' },
      { path: join(workspace.path, 'new.txt'), letter: 'U' },
      { path: join(workspace.path, 'removed.txt'), letter: 'D' },
    ]))
  })

  it('lists files inside an untracked directory instead of the directory itself', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    initGitRepo(workspacePath)
    writeFileSync(join(workspacePath, 'tracked.txt'), 'v1')
    execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })
    execSync('git commit -m "init"', { cwd: workspacePath, stdio: 'ignore' })

    mkdirSync(join(workspacePath, 'tests', 'hahah'), { recursive: true })
    writeFileSync(join(workspacePath, 'tests', 'hahah', 'test.md'), 'hello\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const status = expectOk(await api.host.gitStatus(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    const nested = join(workspace.path, 'tests', 'hahah', 'test.md')
    expect(status.entries).toEqual(expect.arrayContaining([
      { path: nested, letter: 'U' },
    ]))
    expect(status.entries.map(entry => entry.path)).not.toContain(join(workspace.path, 'tests', 'hahah'))
  })

  it('returns an empty entry list when the Workspace is not a git repository', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'plain')
    mkdirSync(workspacePath)
    writeFileSync(join(workspacePath, 'readme.txt'), 'hello')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const status = expectOk(await api.host.gitStatus(
      request({ workspaceId: workspace.workspaceId }),
      new AbortController().signal,
    ))

    expect(status.entries).toEqual([])
  })

  it('returns an empty entry list when git is unavailable on the host', async () => {
    const runSpy = vi.spyOn(nativeCommand, 'runNativeCommand').mockRejectedValue(
      Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }),
    )
    try {
      const { api, root } = await harness()
      const workspacePath = join(root, 'repo')
      mkdirSync(workspacePath)
      initGitRepo(workspacePath)
      writeFileSync(join(workspacePath, 'tracked.txt'), 'v1')
      execSync('git add tracked.txt', { cwd: workspacePath, stdio: 'ignore' })
      execSync('git commit -m "init"', { cwd: workspacePath, stdio: 'ignore' })

      const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
      const status = expectOk(await api.host.gitStatus(
        request({ workspaceId: workspace.workspaceId }),
        new AbortController().signal,
      ))

      expect(status.entries).toEqual([])
    } finally {
      runSpy.mockRestore()
    }
  })

  it('reports workspace-not-found for an unknown workspace id', async () => {
    const { api } = await harness()
    const response = await api.host.gitStatus(
      request({ workspaceId: 'missing' as WorkspaceId }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
    })
  })
})
