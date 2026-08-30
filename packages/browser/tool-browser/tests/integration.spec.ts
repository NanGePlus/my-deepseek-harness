/**
 * Agent-loop integration: browser_* tools append tool/call and tool/result to the session log.
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import * as ToolBrowser from '@deepseek-ai/dsh-tool-browser'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const WORKSPACE_ID = WorkspaceId('ws-it-browser')
const TAB = 'tab-it-1'

function ok<T>(request: RpcRequest<unknown>, value: T): RpcResponse<T> {
  return { rpcId: request.rpcId, result: { ok: true, value } }
}

function findEvent<T extends SessionEvent['type']>(
  log: readonly SessionEvent[],
  type: T,
): Extract<SessionEvent, { type: T }> {
  const found = log.find(event => event.type === type)
  if (!found) throw new Error(`no ${type} event in the session log`)
  return found as Extract<SessionEvent, { type: T }>
}

async function harness(): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.provide('apiProxy', {
    host: {
      browserList: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, {
        tabs: [{
          tabId: TAB,
          url: 'about:blank',
          title: '',
          selected: true,
          canGoBack: false,
          canGoForward: false,
        }],
      })),
      browserNavigate: (request: RpcRequest<{ url: string }>) => Promise.resolve(ok(request, {
        url: request.payload.url,
        title: 'IT',
        canGoBack: false,
        canGoForward: false,
      })),
      browserSnapshot: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { tree: '- button "Go"\n' })),
      browserCreateTab: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { tabId: TAB })),
      browserCloseTab: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { closed: true as const })),
      browserSelectTab: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { selected: true as const })),
      browserGoBack: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, {
        url: 'about:blank', title: '', canGoBack: false, canGoForward: false,
      })),
      browserGoForward: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, {
        url: 'about:blank', title: '', canGoBack: false, canGoForward: false,
      })),
      browserReload: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, {
        url: 'about:blank', title: '', canGoBack: false, canGoForward: false,
      })),
      browserClick: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { clicked: true as const })),
      browserType: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { typed: true as const })),
      browserScroll: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { scrolled: true as const })),
      browserSelectOption: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { selected: true as const })),
      browserResizeViewport: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { resized: true as const })),
      browserSendPointer: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { sent: true as const })),
      browserSendKeyboard: (request: RpcRequest<unknown>) => Promise.resolve(ok(request, { sent: true as const })),
      browserWatchScreencast: async function* () {
        yield { rpcId: RpcId('it-frame'), payload: { type: 'host/browser-screencast', data: '', width: 1, height: 1 } }
      },
    },
  } as unknown as ApiProxy)
  const sessionIds: ReturnType<typeof SessionId>[] = []
  const workspaceStub = {
    id: WORKSPACE_ID,
    path: process.cwd(),
    title: 'it',
    sessionIds,
    attachSession: async (sessionId: ReturnType<typeof SessionId>) => {
      sessionIds.push(sessionId)
    },
    detachSession: async () => {},
    insertSessionBefore: async () => {},
  } as unknown as Workspace
  ctx.provide('workspaceRegistry', {
    list: () => [workspaceStub],
    get: (id: typeof WORKSPACE_ID) => id === WORKSPACE_ID ? workspaceStub : undefined,
  })
  await ctx.plugin(ToolBrowser)
  ctx.llm.registerAdapter(['mock'], new MockAdapter([
    toolCallResponse('call-1', 'browser_navigate', { url: 'https://example.com/' }),
    toolCallResponse('call-2', 'browser_snapshot', {}),
    textResponse('Done browsing.'),
  ]))
  return ctx
}

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
}

describe('browser_* tools through the agent loop', () => {
  it('writes tool/call and tool/result session events for browser_navigate and browser_snapshot', async () => {
    const ctx = await harness()
    const agent = ctx.agentLoop.create(SessionId('it-browser-log'), { provider: 'mock', model: 'mock' })
    await ctx.workspaceRegistry.list()[0]!.attachSession(agent.id)
    agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'open the page' }],
      source: { kind: 'user' },
    }))
    await waitForIdle(ctx, agent)

    const log = agent.session.events
    expect(findEvent(log, 'tool/call').data.name).toBe('browser_navigate')
    expect(findEvent(log, 'tool/result').data.message.content[0]?.isError).toBe(false)
    expect(log.filter(event => event.type === 'tool/call').map(event => event.data.name)).toEqual([
      'browser_navigate',
      'browser_snapshot',
    ])
  })
})
