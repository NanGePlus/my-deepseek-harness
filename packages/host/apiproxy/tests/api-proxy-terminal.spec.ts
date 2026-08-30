import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
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
import type { TerminalStreamFrame, WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import type { HumanTerminalInternals } from '@deepseek-ai/dsh-host-apiproxy/src/human-terminal.ts'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`terminal-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

function expectErr(response: RpcResponse<unknown>, code: string): void {
  expect(response.result.ok).toBe(false)
  if (response.result.ok) throw new Error('unreachable')
  expect(response.result.error.code).toBe(code)
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
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-terminal-'))),
  humanTerminal?: HumanTerminalInternals,
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
    ...(humanTerminal === undefined ? {} : { humanTerminal }),
  })
  return { api, root }
}

async function createWorkspace(
  api: Awaited<ReturnType<typeof harness>>['api'],
  path: string,
): Promise<WorkspaceId> {
  mkdirSync(path, { recursive: true })
  const created = expectOk(await api.workspace.create(request({ path })))
  return created.workspace.workspaceId
}

async function collectStreamOutput(
  stream: AsyncIterable<RpcRequest<TerminalStreamFrame>>,
  until: (frames: TerminalStreamFrame[]) => boolean,
  timeoutMs = 10_000,
): Promise<TerminalStreamFrame[]> {
  const frames: TerminalStreamFrame[] = []
  const timer = setTimeout(() => { throw new Error('timed out waiting for terminal stream frames') }, timeoutMs)
  try {
    for await (const envelope of stream) {
      frames.push(envelope.payload)
      if (until(frames)) break
    }
  } finally {
    clearTimeout(timer)
  }
  return frames
}

describe('host.terminal.* integration seam', () => {
  it('profiles returns bash/zsh or platform equivalent with login shell default', async () => {
    const { api } = await harness()
    const controller = new AbortController()
    const profiles = expectOk(await api.host.terminalProfiles(request({}), controller.signal))
    expect(profiles.profiles.length).toBeGreaterThan(0)
    expect(profiles.profiles.some(profile => profile.id === 'bash' || profile.id === 'zsh')).toBe(true)
    expect(profiles.profiles.some(profile => profile.id === profiles.defaultProfileId)).toBe(true)
  })

  it('spawn adds a session to list with workspace root cwd', async () => {
    const { api, root } = await harness()
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const spawned = expectOk(await api.host.terminalSpawn(request({ workspaceId }), controller.signal))
    const listed = expectOk(await api.host.terminalList(request({ workspaceId }), controller.signal))
    expect(listed.sessions.some(session => session.sessionId === spawned.sessionId)).toBe(true)
  })

  it('stream delivers output, write gets a response, and resize succeeds', async () => {
    const { api, root } = await harness()
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const spawned = expectOk(await api.host.terminalSpawn(request({ workspaceId }), controller.signal))
    const streamController = new AbortController()
    const marker = `terminal-echo-${Date.now()}`
    const streamPromise = collectStreamOutput(
      api.host.terminalStream(request({ workspaceId, sessionId: spawned.sessionId }), streamController.signal),
      frames => frames.some(frame => frame.type === 'host/terminal-output' && frame.text.includes(marker)),
    )
    await new Promise(resolve => setTimeout(resolve, 500))
    expectOk(await api.host.terminalWrite(
      request({ workspaceId, sessionId: spawned.sessionId, text: `echo ${marker}\n` }),
      controller.signal,
    ))
    const frames = await streamPromise
    expect(frames.some(frame => frame.type === 'host/terminal-output' && frame.text.includes(marker))).toBe(true)
    expectOk(await api.host.terminalResize(
      request({ workspaceId, sessionId: spawned.sessionId, cols: 100, rows: 40 }),
      controller.signal,
    ))
    streamController.abort()
  })

  it('kill removes the session from list', async () => {
    const { api, root } = await harness()
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const spawned = expectOk(await api.host.terminalSpawn(request({ workspaceId }), controller.signal))
    expectOk(await api.host.terminalKill(request({ workspaceId, sessionId: spawned.sessionId }), controller.signal))
    const listed = expectOk(await api.host.terminalList(request({ workspaceId }), controller.signal))
    expect(listed.sessions.some(session => session.sessionId === spawned.sessionId)).toBe(false)
  })

  it('scrollback reports truncated when output exceeds the bound', async () => {
    const { api, root } = await harness(realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-terminal-scroll-'))), {
      scrollbackMaxBytes: 64,
    })
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const spawned = expectOk(await api.host.terminalSpawn(request({ workspaceId }), controller.signal))
    const streamController = new AbortController()
    const blob = 'x'.repeat(200)
    const streamPromise = collectStreamOutput(
      api.host.terminalStream(request({ workspaceId, sessionId: spawned.sessionId }), streamController.signal),
      frames => frames.some(frame => frame.type === 'host/terminal-scrollback' && frame.truncated),
    )
    await new Promise(resolve => setTimeout(resolve, 500))
    expectOk(await api.host.terminalWrite(
      request({ workspaceId, sessionId: spawned.sessionId, text: `printf '${blob}'\n` }),
      controller.signal,
    ))
    await new Promise(resolve => setTimeout(resolve, 500))
    const reconnect = new AbortController()
    const frames = await collectStreamOutput(
      api.host.terminalStream(request({ workspaceId, sessionId: spawned.sessionId }), reconnect.signal),
      collected => collected.some(frame => frame.type === 'host/terminal-scrollback' && frame.truncated),
      5_000,
    )
    streamController.abort()
    reconnect.abort()
    void streamPromise
    expect(frames.some(frame => frame.type === 'host/terminal-scrollback' && frame.truncated)).toBe(true)
  })

  it('keeps host sessions alive while the client stream is disconnected', async () => {
    const { api, root } = await harness()
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const spawned = expectOk(await api.host.terminalSpawn(request({ workspaceId }), controller.signal))
    const streamController = new AbortController()
    const marker = `persist-${Date.now()}`
    const stream = api.host.terminalStream(
      request({ workspaceId, sessionId: spawned.sessionId }),
      streamController.signal,
    )
    void (async () => {
      for await (const _frame of stream) {
        // drain until abort
      }
    })()
    await new Promise(resolve => setTimeout(resolve, 500))
    expectOk(await api.host.terminalWrite(
      request({ workspaceId, sessionId: spawned.sessionId, text: `echo ${marker}\n` }),
      controller.signal,
    ))
    await new Promise(resolve => setTimeout(resolve, 500))
    streamController.abort()
    const listed = expectOk(await api.host.terminalList(request({ workspaceId }), controller.signal))
    expect(listed.sessions.some(session => session.sessionId === spawned.sessionId)).toBe(true)
    const reconnect = new AbortController()
    const frames = await collectStreamOutput(
      api.host.terminalStream(request({ workspaceId, sessionId: spawned.sessionId }), reconnect.signal),
      collected => collected.some(frame => frame.type === 'host/terminal-scrollback' && frame.text.includes(marker)),
    )
    reconnect.abort()
    expect(frames.some(frame => frame.type === 'host/terminal-scrollback' && frame.text.includes(marker))).toBe(true)
  })

  it('title metadata follows a foreground fixture process', async () => {
    const { api, root } = await harness(realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-terminal-title-'))), {
      titlePollMs: 100,
    })
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const spawned = expectOk(await api.host.terminalSpawn(request({ workspaceId }), controller.signal))
    const streamController = new AbortController()
    const streamPromise = collectStreamOutput(
      api.host.terminalStream(request({ workspaceId, sessionId: spawned.sessionId }), streamController.signal),
      frames => frames.some(frame => frame.type === 'host/terminal-title' && frame.titleCommand === 'node'),
      15_000,
    )
    await new Promise(resolve => setTimeout(resolve, 500))
    expectOk(await api.host.terminalWrite(
      request({
        workspaceId,
        sessionId: spawned.sessionId,
        text: 'node -e "setInterval(()=>{}, 10000)"\n',
      }),
      controller.signal,
    ))
    const frames = await streamPromise
    streamController.abort()
    expect(frames.some(frame => frame.type === 'host/terminal-title' && frame.titleCommand === 'node')).toBe(true)
  })

  it('isolates sessions per workspace', async () => {
    const { api, root } = await harness()
    mkdirSync(join(root, 'a'), { recursive: true })
    mkdirSync(join(root, 'b'), { recursive: true })
    const workspaceA = await createWorkspace(api, join(root, 'a'))
    const workspaceB = await createWorkspace(api, join(root, 'b'))
    const controller = new AbortController()
    const sessionA = expectOk(await api.host.terminalSpawn(request({ workspaceId: workspaceA }), controller.signal))
    const sessionB = expectOk(await api.host.terminalSpawn(request({ workspaceId: workspaceB }), controller.signal))
    const listA = expectOk(await api.host.terminalList(request({ workspaceId: workspaceA }), controller.signal))
    const listB = expectOk(await api.host.terminalList(request({ workspaceId: workspaceB }), controller.signal))
    expect(listA.sessions.map(session => session.sessionId)).toEqual([sessionA.sessionId])
    expect(listB.sessions.map(session => session.sessionId)).toEqual([sessionB.sessionId])
  })

  it('spawn failure returns terminal-unavailable', async () => {
    const { api, root } = await harness(realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-terminal-fail-'))), {
      spawn: () => { throw new Error('pty backend missing') },
    })
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const response = await api.host.terminalSpawn(request({ workspaceId }), controller.signal)
    expectErr(response, 'terminal-unavailable')
  })
})
