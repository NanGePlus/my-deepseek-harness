import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import { DirectoryPickerError } from '@deepseek-ai/dsh-host-directory-picker'
import type { DirectoryPickerCapability } from '@deepseek-ai/dsh-host-directory-picker'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { WORKSPACE_LISTING_MAX_ENTRIES } from '@deepseek-ai/dsh-host-apiproxy/src/list-workspace-entries.ts'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`list-ws-entries-${String(nextRpc++)}`), payload }
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
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-list-ws-entries-'))),
  picker: DirectoryPickerCapability = { kind: 'native', pick: async () => null },
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
  ctx.provide('directoryPicker', { capability: () => picker } as never)
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }),
    cwd: root,
  })
  return { api, root }
}

describe('host.listWorkspaceEntries', () => {
  it('returns one level of files and folders with name, path, isDirectory, and hidden', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'project')
    mkdirSync(workspacePath)
    writeFileSync(join(workspacePath, 'readme.txt'), 'hello')
    writeFileSync(join(workspacePath, '.hidden'), '')
    mkdirSync(join(workspacePath, 'src'))

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const listed = expectOk(await api.host.listWorkspaceEntries(
      request({ workspaceId: workspace.workspaceId, path: workspace.path }),
      new AbortController().signal,
    ))

    expect(listed.path).toBe(workspace.path)
    expect(listed.truncated).toBe(false)
    expect(listed.entries).toEqual(expect.arrayContaining([
      { name: 'readme.txt', path: join(workspace.path, 'readme.txt'), isDirectory: false, hidden: false },
      { name: '.hidden', path: join(workspace.path, '.hidden'), isDirectory: false, hidden: true },
      { name: 'src', path: join(workspace.path, 'src'), isDirectory: true, hidden: false },
    ]))
    expect(listed.entries).toHaveLength(3)
    expect(listed.entries.map(entry => entry.name).sort()).toEqual(['.hidden', 'readme.txt', 'src'])
  })

  it('rejects paths outside the bound Workspace root', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'project')
    mkdirSync(workspacePath)
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const outside = join(root, 'outside')

    const response = await api.host.listWorkspaceEntries(
      request({ workspaceId: workspace.workspaceId, path: outside }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'workspace-path-out-of-bounds',
        details: { workspaceId: workspace.workspaceId, path: outside },
      },
    })

    const missing = await api.host.listWorkspaceEntries(
      request({ workspaceId: 'missing' as WorkspaceId, path: workspace.path }),
      new AbortController().signal,
    )
    expect(missing.result).toMatchObject({
      ok: false,
      error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
    })
  })

  it('sets truncated when a level exceeds the complete-result bound', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'large')
    mkdirSync(workspacePath)
    for (let index = 0; index < WORKSPACE_LISTING_MAX_ENTRIES + 1; index += 1) {
      writeFileSync(join(workspacePath, `file-${String(index).padStart(5, '0')}.txt`), '')
    }
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const listed = expectOk(await api.host.listWorkspaceEntries(
      request({ workspaceId: workspace.workspaceId, path: workspace.path }),
      new AbortController().signal,
    ))

    expect(listed.truncated).toBe(true)
    expect(listed.entries).toHaveLength(WORKSPACE_LISTING_MAX_ENTRIES)
    expect(listed.entries.every(entry => !entry.isDirectory)).toBe(true)
  })

  it('reports an aborted listing as cancelled', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'abort')
    mkdirSync(workspacePath)
    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const abort = new AbortController()
    abort.abort()
    expect((await api.host.listWorkspaceEntries(
      request({ workspaceId: workspace.workspaceId, path: workspace.path }),
      abort.signal,
    )).result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  })
})

/** Canned browse capability for listDirectory contract checks. */
const BROWSE_STUB: DirectoryPickerCapability = {
  kind: 'browse',
  list: async (path) => {
    if (path === '/denied') throw new DirectoryPickerError('directory-unreadable', '/denied', 'cannot list /denied')
    const target = path ?? '/home/user'
    return {
      path: target,
      home: '/home/user',
      crumbs: [{ name: '/', path: '/', hidden: false }],
      entries: [{ name: 'projects', path: `${target}/projects`, hidden: false }],
      truncated: false,
    }
  },
  createDirectory: async (path, name) => `${path}/${name}`,
}

describe('host.listDirectory contract (unchanged by listWorkspaceEntries)', () => {
  it('still serves directory-only browse listings through the browse capability', async () => {
    const { api } = await harness(undefined, BROWSE_STUB)
    const home = await api.host.listDirectory(request({}), new AbortController().signal)
    expect(home.result).toMatchObject({
      ok: true,
      value: {
        path: '/home/user',
        home: '/home/user',
        entries: [{ name: 'projects', path: '/home/user/projects', hidden: false }],
        truncated: false,
      },
    })
    expect((await api.host.listDirectory(request({ path: '/denied' }), new AbortController().signal)).result)
      .toMatchObject({ ok: false, error: { code: 'directory-unreadable', details: { path: '/denied' } } })
  })
})
