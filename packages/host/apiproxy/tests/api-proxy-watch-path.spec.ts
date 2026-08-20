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
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { RpcRequest, WatchPathFrame } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`watch-path-${String(nextRpc++)}`), payload }
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
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-watch-path-'))),
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

async function nextPathChanged(
  stream: AsyncIterable<RpcRequest<WatchPathFrame>>,
  mutate: () => void,
  timeoutMs = 5000,
): Promise<WatchPathFrame> {
  const iterator = stream[Symbol.asyncIterator]()
  const changed = new Promise<WatchPathFrame>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('timed out waiting for host/path-changed')) }, timeoutMs)
    void (async () => {
      try {
        while (true) {
          const next = await iterator.next()
          if (next.done === true) {
            clearTimeout(timer)
            reject(new Error('watchPath stream ended before host/path-changed'))
            return
          }
          if (next.value.payload.type === 'host/path-changed') {
            clearTimeout(timer)
            resolve(next.value.payload)
            return
          }
        }
      } catch (error: unknown) {
        clearTimeout(timer)
        reject(error)
      }
    })()
  })
  await new Promise<void>((resolve) => { setTimeout(resolve, 50) })
  mutate()
  return changed
}

describe('host.watchPath', () => {
  it('emits host/path-changed when an opened file is rewritten on disk', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const filePath = join(workspacePath, 'src', 'app.ts')
    mkdirSync(join(workspacePath, 'src'))
    writeFileSync(filePath, 'export const app = 1\n')

    const workspace = (await api.workspace.create(request({ path: workspacePath }))).result
    if (!workspace.ok) throw new Error('unreachable')
    const controller = new AbortController()
    const stream = api.host.watchPath(
      request({ workspaceId: workspace.value.workspace.workspaceId, path: filePath }),
      controller.signal,
    )

    const frame = await nextPathChanged(stream, () => {
      writeFileSync(filePath, 'export const app = 2\n')
    })

    expect(frame).toEqual({ type: 'host/path-changed', path: filePath })
    controller.abort()
  }, 10_000)

  it('does not deliver host/path-changed after the subscription is aborted', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const filePath = join(workspacePath, 'notes.txt')
    writeFileSync(filePath, 'v1\n')

    const workspace = (await api.workspace.create(request({ path: workspacePath }))).result
    if (!workspace.ok) throw new Error('unreachable')
    const controller = new AbortController()
    const stream = api.host.watchPath(
      request({ workspaceId: workspace.value.workspace.workspaceId, path: filePath }),
      controller.signal,
    )

    await nextPathChanged(stream, () => {
      writeFileSync(filePath, 'v2\n')
    })
    controller.abort()

    const afterAbort = stream[Symbol.asyncIterator]().next()
    writeFileSync(filePath, 'v3\n')
    const result = await Promise.race([
      afterAbort,
      new Promise<'timeout'>((resolve) => { setTimeout(() => { resolve('timeout') }, 500) }),
    ])
    expect(result === 'timeout' || (typeof result === 'object' && result.done === true)).toBe(true)
  }, 10_000)
})
