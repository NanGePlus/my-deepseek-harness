import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
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
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`read-write-file-${String(nextRpc++)}`), payload }
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
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-read-write-file-'))),
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

describe('host.readFile', () => {
  it('returns text content and path matching the on-disk file inside the bound Workspace', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const filePath = join(workspacePath, 'src', 'app.ts')
    mkdirSync(join(workspacePath, 'src'))
    writeFileSync(filePath, 'export const app = 1\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const read = expectOk(await api.host.readFile(
      request({ workspaceId: workspace.workspaceId, path: filePath, kind: 'text' }),
      new AbortController().signal,
    ))

    expect(read).toEqual({ kind: 'text', path: filePath, text: 'export const app = 1\n' })
  })

  it('returns canonical base64 bytes and media type for a PNG inside the bound Workspace', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const filePath = join(workspacePath, 'logo.png')
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    writeFileSync(filePath, bytes)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const read = expectOk(await api.host.readFile(
      request({ workspaceId: workspace.workspaceId, path: filePath, kind: 'bytes' }),
      new AbortController().signal,
    ))

    expect(read).toEqual({
      kind: 'bytes',
      path: filePath,
      data: bytes.toString('base64'),
      mediaType: 'image/png',
    })
  })
})

describe('host.writeFile', () => {
  it('writes editable text to a bound Workspace path and matches disk afterward', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const filePath = join(workspacePath, 'notes.txt')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const written = expectOk(await api.host.writeFile(
      request({ workspaceId: workspace.workspaceId, path: filePath, text: 'hello editor\n' }),
      new AbortController().signal,
    ))

    expect(written).toEqual({ path: filePath })
    expect(readFileSync(filePath, 'utf8')).toBe('hello editor\n')
  })
})

describe('host.readFile and host.writeFile path bounds', () => {
  it('reject reads outside the bound Workspace root', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const outside = join(root, 'outside.txt')
    writeFileSync(outside, 'secret')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.readFile(
      request({ workspaceId: workspace.workspaceId, path: outside, kind: 'text' }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'workspace-path-out-of-bounds',
        details: { workspaceId: workspace.workspaceId, path: outside },
      },
    })
  })

  it('reject writes outside the bound Workspace root', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const outside = join(root, 'outside.txt')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.writeFile(
      request({ workspaceId: workspace.workspaceId, path: outside, text: 'nope' }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'workspace-path-out-of-bounds',
        details: { workspaceId: workspace.workspaceId, path: outside },
      },
    })
    expect(() => readFileSync(outside, 'utf8')).toThrow()
  })

  it('reports workspace-not-found for an unknown workspace id on read', async () => {
    const { api } = await harness()
    const response = await api.host.readFile(
      request({ workspaceId: 'missing' as never, path: '/tmp/x', kind: 'text' }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
    })
  })

  it('reports file-not-found when the target path is absent', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const missing = join(workspacePath, 'gone.txt')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.readFile(
      request({ workspaceId: workspace.workspaceId, path: missing, kind: 'text' }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'file-not-found', details: { path: missing } },
    })
  })

  it('reports file-not-regular when the target is a directory', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const dirPath = join(workspacePath, 'src')
    mkdirSync(dirPath)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.readFile(
      request({ workspaceId: workspace.workspaceId, path: dirPath, kind: 'text' }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'file-not-regular', details: { path: dirPath } },
    })
  })
})
