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
import type { BrowserScreencastFrame, WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import type { BrowserRegistryInternals } from '@deepseek-ai/dsh-host-apiproxy/src/browser-registry.ts'
import { chromium } from 'playwright'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`browser-${String(nextRpc++)}`), payload }
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

function chromiumAvailable(): boolean {
  try {
    chromium.executablePath()
    return true
  } catch {
    return false
  }
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
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-browser-'))),
  browserRegistry?: BrowserRegistryInternals,
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
    ...(browserRegistry === undefined ? {} : { browserRegistry }),
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

async function collectScreencastFrames(
  stream: AsyncIterable<RpcRequest<BrowserScreencastFrame>>,
  until: (frames: BrowserScreencastFrame[]) => boolean,
  timeoutMs = 15_000,
): Promise<BrowserScreencastFrame[]> {
  const frames: BrowserScreencastFrame[] = []
  const timer = setTimeout(() => { throw new Error('timed out waiting for browser screencast frames') }, timeoutMs)
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

describe('host.browser.* integration seam', () => {
  it('createTab adds a tab to list with tabId, url, title, and selected', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    const row = listed.tabs.find(tab => tab.tabId === created.tabId)
    expect(row).toBeDefined()
    expect(row?.selected).toBe(true)
    expect(row?.url).toContain('about:blank')
  })

  it('navigate updates title and url; snapshot returns an accessibility tree', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'fixture')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, '<!doctype html><html><head><title>Browser Fixture</title></head><body><h1>Hello</h1></body></html>')
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    const navigated = expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expect(navigated.title).toBe('Browser Fixture')
    expect(navigated.url).toContain('page.html')
    const snap = expectOk(await api.host.browserSnapshot(
      request({ workspaceId, tabId: created.tabId }),
      controller.signal,
    ))
    expect(snap.tree.length).toBeGreaterThan(0)
    expect(snap.tree).toContain('Hello')
  })

  it('watchScreencast delivers JPEG frames', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'screencast')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, '<!doctype html><html><body style="background:red;width:200px;height:200px"></body></html>')
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    const streamController = new AbortController()
    const streamPromise = collectScreencastFrames(
      api.host.browserWatchScreencast(request({ workspaceId, tabId: created.tabId }), streamController.signal),
      frames => frames.some(frame => frame.type === 'host/browser-screencast' && frame.data.length > 0),
      20_000,
    )
    const frames = await streamPromise
    streamController.abort()
    expect(frames.some(frame => frame.type === 'host/browser-screencast')).toBe(true)
  }, 25_000)

  it('closeTab removes the tab from list', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserCloseTab(request({ workspaceId, tabId: created.tabId }), controller.signal))
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(listed.tabs.some(tab => tab.tabId === created.tabId)).toBe(false)
  })

  it('isolates BrowserContext per workspace', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    mkdirSync(join(root, 'a'), { recursive: true })
    mkdirSync(join(root, 'b'), { recursive: true })
    const workspaceA = await createWorkspace(api, join(root, 'a'))
    const workspaceB = await createWorkspace(api, join(root, 'b'))
    const controller = new AbortController()
    const tabA = expectOk(await api.host.browserCreateTab(request({ workspaceId: workspaceA }), controller.signal))
    const tabB = expectOk(await api.host.browserCreateTab(request({ workspaceId: workspaceB }), controller.signal))
    const listA = expectOk(await api.host.browserList(request({ workspaceId: workspaceA }), controller.signal))
    const listB = expectOk(await api.host.browserList(request({ workspaceId: workspaceB }), controller.signal))
    expect(listA.tabs.map(tab => tab.tabId)).toEqual([tabA.tabId])
    expect(listB.tabs.map(tab => tab.tabId)).toEqual([tabB.tabId])
  })

  it('createTab failure returns browser-unavailable with distinguishable reason', async () => {
    const { api, root } = await harness(realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-browser-fail-'))), {
      chromiumExecutablePath: () => { throw new Error('missing') },
    })
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const response = await api.host.browserCreateTab(request({ workspaceId }), controller.signal)
    expectErr(response, 'browser-unavailable')
    if (response.result.ok) throw new Error('unreachable')
    expect(response.result.error.details).toMatchObject({ reason: 'chromium-missing' })
  })

  it('keeps host BrowserContext alive while the client screencast stream is disconnected', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'nav')
    mkdirSync(fixtureDir, { recursive: true })
    const firstPath = join(fixtureDir, 'first.html')
    const secondPath = join(fixtureDir, 'second.html')
    writeFileSync(firstPath, '<!doctype html><html><head><title>First</title></head><body></body></html>')
    writeFileSync(secondPath, '<!doctype html><html><head><title>Second</title></head><body></body></html>')
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${firstPath}` }),
      controller.signal,
    ))
    const streamController = new AbortController()
    const stream = api.host.browserWatchScreencast(
      request({ workspaceId, tabId: created.tabId }),
      streamController.signal,
    )
    void (async () => {
      for await (const _frame of stream) {
        // drain until abort
      }
    })()
    await new Promise(resolve => setTimeout(resolve, 500))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${secondPath}` }),
      controller.signal,
    ))
    streamController.abort()
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(listed.tabs.some(tab => tab.tabId === created.tabId)).toBe(true)
    expectOk(await api.host.browserGoBack(request({ workspaceId, tabId: created.tabId }), controller.signal))
    expectOk(await api.host.browserGoForward(request({ workspaceId, tabId: created.tabId }), controller.signal))
    expectOk(await api.host.browserReload(request({ workspaceId, tabId: created.tabId, hard: true }), controller.signal))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 900, height: 600 }),
      controller.signal,
    ))
    expectOk(await api.host.browserScroll(request({ workspaceId, tabId: created.tabId, deltaX: 0, deltaY: 120 }), controller.signal))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseMoved', x: 10, y: 10 }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'keyDown', key: 'a' }),
      controller.signal,
    ))
  })
})
