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
    browserRegistry: { headless: true, ...browserRegistry },
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

/** Read width and height from a baseline JPEG buffer. */
function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) return null
    const marker = buffer[offset + 1]
    if (marker === 0xd9) return null
    if (offset + 3 >= buffer.length) return null
    const length = buffer.readUInt16BE(offset + 2)
    if (marker === 0xc0 || marker === 0xc2) {
      if (offset + 9 >= buffer.length) return null
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }
    offset += 2 + length
  }
  return null
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
    expectOk(await api.host.browserShowWindow(
      request({ workspaceId, tabId: created.tabId }),
      controller.signal,
    ))
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

  it('resizeViewport with devicePixelRatio captures HiDPI JPEG screencast frames', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'hidpi')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, '<!doctype html><html><body style="margin:0;background:blue;width:200px;height:150px"></body></html>')
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 200, height: 150, devicePixelRatio: 2 }),
      controller.signal,
    ))
    const streamController = new AbortController()
    const frames = await collectScreencastFrames(
      api.host.browserWatchScreencast(request({ workspaceId, tabId: created.tabId }), streamController.signal),
      collected => collected.some(frame => frame.type === 'host/browser-screencast' && frame.data.length > 0),
      20_000,
    )
    streamController.abort()
    const frame = frames.find(item => item.type === 'host/browser-screencast' && item.data.length > 0)
    expect(frame).toBeDefined()
    if (frame === undefined || frame.type !== 'host/browser-screencast') throw new Error('unreachable')
    expect(frame.width).toBe(200)
    expect(frame.height).toBe(150)
    const jpegDimensions = readJpegDimensions(Buffer.from(frame.data, 'base64'))
    expect(jpegDimensions).toEqual({ width: 400, height: 300 })
  }, 25_000)

  it('browserScroll at coordinates scrolls nested overflow containers', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'nested-scroll')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>top</title></head><body style="margin:0;overflow:hidden">
<div id="panel" style="width:180px;height:120px;overflow:auto">
<div style="height:400px"></div>
<div id="marker">below</div>
<div style="height:200px"></div>
</div>
<script>
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) document.title = 'panel-scrolled'
}).observe(document.getElementById('marker'))
</script>
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 240, height: 180 }),
      controller.signal,
    ))
    const before = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(before.tabs[0]?.title).toBe('top')
    expectOk(await api.host.browserScroll(
      request({ workspaceId, tabId: created.tabId, deltaX: 0, deltaY: 400, x: 90, y: 60 }),
      controller.signal,
    ))
    await new Promise(resolve => setTimeout(resolve, 250))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 90, y: 60 }),
      controller.signal,
    ))
    const after = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(after.tabs[0]?.title).toBe('panel-scrolled')
  }, 25_000)

  it('browserScroll at coordinates does not move a sibling overflow container', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'sibling-scroll')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>top</title></head>
<body style="margin:0;overflow:hidden">
<div id="left" style="position:absolute;left:0;top:0;width:120px;height:120px;overflow:auto">
<div style="height:400px"></div>
<div id="left-mark">L</div>
</div>
<div id="right" style="position:absolute;left:140px;top:0;width:120px;height:120px;overflow:auto">
<div style="height:400px"></div>
<div id="right-mark">R</div>
</div>
<script>
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) document.title = 'left-only'
}).observe(document.getElementById('left-mark'))
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) document.title = 'right-moved'
}).observe(document.getElementById('right-mark'))
</script>
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 280, height: 160 }),
      controller.signal,
    ))
    expectOk(await api.host.browserScroll(
      request({ workspaceId, tabId: created.tabId, deltaX: 0, deltaY: 400, x: 60, y: 60 }),
      controller.signal,
    ))
    await new Promise(resolve => setTimeout(resolve, 250))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 60, y: 60 }),
      controller.signal,
    ))
    const after = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(after.tabs[0]?.title).toBe('left-only')
  }, 25_000)

  it('browserSendPointer returns the computed CSS cursor at the pointer', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'cursor-styles')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>cursors</title></head>
<body style="margin:0">
<a id="link" href="#ok" style="position:absolute;left:10px;top:10px;width:80px;height:40px;cursor:pointer">link</a>
<input id="field" style="position:absolute;left:10px;top:70px;width:100px;height:24px;cursor:text">
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 240, height: 180 }),
      controller.signal,
    ))
    const overLink = expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseMoved', x: 40, y: 30 }),
      controller.signal,
    ))
    expect(overLink.cursor).toBe('pointer')
    const overField = expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseMoved', x: 40, y: 80 }),
      controller.signal,
    ))
    expect(overField.cursor).toBe('text')
  }, 25_000)

  it('browserSendPointer press and release clicks a button', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'click-button')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>idle</title></head>
<body style="margin:0">
<button id="go" style="position:absolute;left:10px;top:10px;width:80px;height:32px" onclick="document.title='clicked'">Go</button>
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 240, height: 120 }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseMoved', x: 50, y: 26 }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mousePressed', x: 50, y: 26, button: 'left' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 50, y: 26, button: 'left' }),
      controller.signal,
    ))
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(listed.tabs[0]?.title).toBe('clicked')
  }, 25_000)

  it('browserSendPointer press and release clicks a button at devicePixelRatio 2', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'click-button-hidpi')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>idle</title></head>
<body style="margin:0">
<button id="go" style="position:absolute;left:120px;top:40px;width:80px;height:32px" onclick="document.title='clicked'">Go</button>
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 240, height: 120, devicePixelRatio: 2 }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseMoved', x: 160, y: 56 }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mousePressed', x: 160, y: 56, button: 'left' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 160, y: 56, button: 'left' }),
      controller.signal,
    ))
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(listed.tabs[0]?.title).toBe('clicked')
  }, 25_000)

  it('browserSendPointer click still works after a burst of mouseMoved events', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'click-after-moves')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>idle</title></head>
<body style="margin:0">
<button id="go" style="position:absolute;left:10px;top:10px;width:80px;height:32px" onclick="document.title='clicked'">Go</button>
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 240, height: 120 }),
      controller.signal,
    ))
    for (const x of [12, 24, 36, 48, 50]) {
      expectOk(await api.host.browserSendPointer(
        request({ workspaceId, tabId: created.tabId, type: 'mouseMoved', x, y: 26 }),
        controller.signal,
      ))
    }
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mousePressed', x: 50, y: 26, button: 'left' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 50, y: 26, button: 'left' }),
      controller.signal,
    ))
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(listed.tabs[0]?.title).toBe('clicked')
  }, 25_000)

  it('pointer click then keyboard char types into a focused input', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'type-input')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>type</title></head>
<body style="margin:0">
<input id="field" style="position:absolute;left:10px;top:10px;width:160px;height:28px" oninput="document.title=this.value">
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 240, height: 120 }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mousePressed', x: 80, y: 24, button: 'left' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 80, y: 24, button: 'left' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'char', text: 'hi你好' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'keyDown', key: 'Control' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'keyUp', key: 'Control' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'keyDown' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'char' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'keyUp', key: '' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 80, y: 24, button: 'left' }),
      controller.signal,
    ))
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(listed.tabs[0]?.title).toBe('hi你好')
  }, 25_000)

  it('pointer click focuses an input that prevents default mousedown and accepts CJK', async () => {
    if (!chromiumAvailable()) return
    const { api, root } = await harness()
    const fixtureDir = join(root, 'type-prevent-mousedown')
    mkdirSync(fixtureDir, { recursive: true })
    const fixturePath = join(fixtureDir, 'page.html')
    writeFileSync(fixturePath, `<!doctype html><html><head><title>idle</title></head>
<body style="margin:0">
<input id="field" style="position:absolute;left:10px;top:10px;width:160px;height:28px;outline:none"
  onmousedown="event.preventDefault()" onfocus="document.title='focused'" oninput="document.title=this.value">
<div id="ce" contenteditable="true"
  style="position:absolute;left:10px;top:50px;width:160px;height:28px;outline:none"
  onmousedown="event.preventDefault()"></div>
</body></html>`)
    const workspaceId = await createWorkspace(api, root)
    const controller = new AbortController()
    const created = expectOk(await api.host.browserCreateTab(request({ workspaceId }), controller.signal))
    expectOk(await api.host.browserNavigate(
      request({ workspaceId, tabId: created.tabId, url: `file://${fixturePath}` }),
      controller.signal,
    ))
    expectOk(await api.host.browserResizeViewport(
      request({ workspaceId, tabId: created.tabId, width: 240, height: 120 }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mousePressed', x: 80, y: 24, button: 'left' }),
      controller.signal,
    ))
    expectOk(await api.host.browserSendPointer(
      request({ workspaceId, tabId: created.tabId, type: 'mouseReleased', x: 80, y: 24, button: 'left' }),
      controller.signal,
    ))
    const afterClick = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(afterClick.tabs[0]?.title).toBe('focused')
    expectOk(await api.host.browserSendKeyboard(
      request({ workspaceId, tabId: created.tabId, type: 'char', text: '你好' }),
      controller.signal,
    ))
    const listed = expectOk(await api.host.browserList(request({ workspaceId }), controller.signal))
    expect(listed.tabs[0]?.title).toBe('你好')
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
