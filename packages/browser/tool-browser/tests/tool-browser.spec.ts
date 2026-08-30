/**
 * Integration seam for browser_* tools over stubbed host.browser.* RPC.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy'
import type { RpcRequest, RpcResponse, RpcError } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import * as ToolBrowser from '@deepseek-ai/dsh-tool-browser'

const testToolSignal = new AbortController().signal

const WORKSPACE_ID = WorkspaceId('ws-browser-test')

const TAB = 'tab-shared-1'

function ok<T>(request: RpcRequest<unknown>, value: T): RpcResponse<T> {
  return { rpcId: request.rpcId, result: { ok: true, value } }
}

function err(request: RpcRequest<unknown>, error: RpcError): RpcResponse<never> {
  return { rpcId: request.rpcId, result: { ok: false, error } }
}

function fakeAgent(ctx: Context, sessionId: string): Agent {
  const id = SessionId(sessionId)
  const session = Session.create(id)
  const agent: Agent = {
    id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx,
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(agent)
  return agent
}

type BrowserHostStub = ApiProxy['host']

function createBrowserHostStub(overrides: Partial<BrowserHostStub> = {}): BrowserHostStub {
  const tabs = [{
    tabId: TAB,
    url: 'about:blank',
    title: '',
    selected: true,
    canGoBack: false,
    canGoForward: false,
  }]
  const base = {
    browserList: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { tabs: [...tabs] })),
    browserCreateTab: (request: RpcRequest<{ url?: string }>) => {
      const tabId = `tab-${tabs.length + 1}`
      tabs.push({
        tabId,
        url: request.payload.url ?? 'about:blank',
        title: '',
        selected: true,
        canGoBack: false,
        canGoForward: false,
      })
      for (const tab of tabs) tab.selected = tab.tabId === tabId
      return Promise.resolve(ok(request, { tabId }))
    },
    browserCloseTab: (request: RpcRequest<{ tabId: string }>) => {
      const index = tabs.findIndex(tab => tab.tabId === request.payload.tabId)
      if (index >= 0) tabs.splice(index, 1)
      return Promise.resolve(ok(request, { closed: true as const }))
    },
    browserSelectTab: (request: RpcRequest<{ tabId: string }>) => {
      for (const tab of tabs) tab.selected = tab.tabId === request.payload.tabId
      return Promise.resolve(ok(request, { selected: true as const }))
    },
    browserNavigate: (request: RpcRequest<{ tabId: string; url: string }>) => {
      const tab = tabs.find(entry => entry.tabId === request.payload.tabId)
      if (tab !== undefined) {
        tab.url = request.payload.url
        tab.title = 'Example'
      }
      return Promise.resolve(ok(request, {
        url: request.payload.url,
        title: 'Example',
        canGoBack: false,
        canGoForward: false,
      }))
    },
    browserGoBack: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, {
      url: 'about:blank',
      title: '',
      canGoBack: false,
      canGoForward: false,
    })),
    browserGoForward: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, {
      url: 'about:blank',
      title: '',
      canGoBack: false,
      canGoForward: false,
    })),
    browserReload: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, {
      url: 'about:blank',
      title: '',
      canGoBack: false,
      canGoForward: false,
    })),
    browserSnapshot: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { tree: '- button "Submit"\n' })),
    browserClick: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { clicked: true as const })),
    browserType: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { typed: true as const })),
    browserScroll: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { scrolled: true as const })),
    browserSelectOption: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { selected: true as const })),
    browserResizeViewport: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { resized: true as const })),
    browserSendPointer: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { sent: true as const })),
    browserSendKeyboard: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { sent: true as const })),
    browserWatchScreencast: async function* () {
      yield { rpcId: RpcId('frame-1'), payload: { type: 'host/browser-screencast', data: '', width: 1, height: 1 } }
    },
  }
  return { ...base, ...overrides } as unknown as BrowserHostStub
}

async function mount(
  overrides: Partial<BrowserHostStub> = {},
  config: ToolBrowser.Config = {},
): Promise<{
  ctx: Context
  agent: Agent
  call: (name: string, args: unknown) => Promise<ToolExecutionResult>
}> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  const host = createBrowserHostStub(overrides)
  ctx.provide('apiProxy', { host } as unknown as ApiProxy)
  const agent = fakeAgent(ctx, 'sess-browser')
  const workspaceStub = {
    id: WORKSPACE_ID,
    path: process.cwd(),
    title: 'browser-test',
    sessionIds: [agent.id],
    attachSession: async () => {},
    detachSession: async () => {},
    insertSessionBefore: async () => {},
  } as unknown as Workspace
  ctx.provide('workspaceRegistry', {
    list: () => [workspaceStub],
    get: (id: typeof WORKSPACE_ID) => id === WORKSPACE_ID ? workspaceStub : undefined,
  })
  await ctx.plugin(ToolBrowser, config)
  let counter = 0
  const call = (name: string, args: unknown) => ctx.tools.execute({
    signal: testToolSignal,
    callId: CallId(`call-${++counter}`),
    name,
    arguments: args,
    agent,
  })
  return { ctx, agent, call }
}

describe('browser_navigate tool-browser seam', () => {
  it('calls host.browserNavigate with the workspace tab id and logs tool/call + tool/result', async () => {
    const navigate = vi.fn(async (request: RpcRequest<{ workspaceId: string; tabId: string; url: string }>) =>
      ok(request, { url: request.payload.url, title: 'Demo', canGoBack: false, canGoForward: false }))
    const { call } = await mount({ browserNavigate: navigate })
    const out = await call('browser_navigate', { url: 'https://example.com/' })
    expect(out.isError).toBe(false)
    expect(out.content.map(block => block.type === 'text' ? block.text : '').join(''))
      .toContain('navigated to https://example.com/')
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ tabId: TAB, url: 'https://example.com/' }) }),
      testToolSignal,
    )
  })
})

describe('browser_snapshot presentation', () => {
  it('uses a terminal result card for the accessibility tree', async () => {
    const { call, ctx } = await mount({
      browserSnapshot: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { tree: '- heading "Hello"\n' })),
    })
    const out = await call('browser_snapshot', {})
    expect(out.isError).toBe(false)
    const def = ctx.tools.get('browser_snapshot')
    expect(def?.presentResult?.({}, { content: out.content, isError: out.isError })).toEqual({
      card: 'terminal',
      title: 'Accessibility snapshot',
      output: '- heading "Hello"\n',
    })
  })
})

describe('shared tab id with Host registry', () => {
  it('browser_navigate reuses the selected tab id from browserList', async () => {
    const list = vi.fn(async (request: RpcRequest<{ workspaceId: string }>) => ok(request, {
      tabs: [{
        tabId: TAB,
        url: 'about:blank',
        title: '',
        selected: true,
        canGoBack: false,
        canGoForward: false,
      }],
    }))
    const navigate = vi.fn(async (request: RpcRequest<{ workspaceId: string; tabId: string; url: string }>) =>
      ok(request, { url: request.payload.url, title: 'T', canGoBack: false, canGoForward: false }))
    const { call } = await mount({ browserList: list, browserNavigate: navigate })
    await call('browser_navigate', { url: 'https://example.com/app' })
    expect(list).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ tabId: TAB }) }),
      testToolSignal,
    )
  })
})

describe('V4 tool surface', () => {
  it('registers only the seven browser_* tools from the PRD', async () => {
    const { ctx } = await mount()
    expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual([
      'browser_click',
      'browser_navigate',
      'browser_scroll',
      'browser_select_option',
      'browser_snapshot',
      'browser_tabs',
      'browser_type',
    ])
  })
})

describe('browser host unavailable', () => {
  it('surfaces browser-unavailable with the Host RPC message', async () => {
    const { call } = await mount({
      browserNavigate: (request: RpcRequest<unknown>) => Promise.resolve(err(request, {
        code: 'browser-unavailable',
        message: 'Chromium is not installed. Run: npx playwright install chromium',
        details: { reason: 'chromium-missing' },
      })),
    })
    const out = await call('browser_navigate', { url: 'https://example.com/' })
    expect(out.isError).toBe(true)
    expect(out.content.map(block => block.type === 'text' ? block.text : '').join(''))
      .toContain('Chromium is not installed')
  })
})

describe('browser_snapshot spill threshold', () => {
  it('bounds oversized trees via finalizeContent before spill policy', async () => {
    const huge = 'x'.repeat(5000)
    const { call } = await mount(
      { browserSnapshot: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { tree: huge })) },
      { snapshotMaxBytes: 1024 },
    )
    const out = await call('browser_snapshot', {})
    const text = out.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(1024)
    expect(text).toContain('[snapshot truncated at 1024 UTF-8 bytes]')
  })
})

describe('browser_tabs', () => {
  it('lists tabs through host.browserList', async () => {
    const list = vi.fn(async (request: RpcRequest<{ workspaceId: string }>) => ok(request, {
      tabs: [{ tabId: TAB, url: 'https://a.test', title: 'A', selected: true, canGoBack: false, canGoForward: false }],
    }))
    const { call } = await mount({ browserList: list })
    const out = await call('browser_tabs', { action: 'list' })
    expect(out.isError).toBe(false)
    expect(out.content.map(block => block.type === 'text' ? block.text : '').join('')).toContain(TAB)
    expect(list).toHaveBeenCalled()
  })
})
