/**
 * IPC downlink pathname routing: SSE paths must hit ApiProxy streams, not unary fetch.
 */

import { describe, expect, it } from 'vitest'
import type { ApiProxy, RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api'
import {
  BROWSER_WATCH_SCREENCAST_PATH,
  HOST_EVENTS_PATH,
  MUX_EVENTS_PATH,
  TERMINAL_STREAM_PATH,
  WATCH_PATH_PATH,
} from '../src/ipc-contract.ts'
import { openApiProxyDownlink } from '../src/ipc-downlink.ts'

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) items.push(item)
  return items
}

function fakeApi(): ApiProxy {
  async function *once<F>(payload: F): AsyncGenerator<RpcRequest<F>> {
    yield { rpcId: RpcId('frame-1'), payload }
  }
  return {
    events: {
      mux: () => once({ type: 'session/subscribed', sessionId: 's1' as never, lastSeq: -1 }),
      host: () => once({ type: 'host/session-removed', sessionId: 's1' as never }),
    },
    host: {
      watchPath: () => once({ type: 'host/watch-path-ready' as const }),
      terminalStream: () => once({ type: 'host/terminal-scrollback' as const, text: 'hi', truncated: false }),
      browserWatchScreencast: () => once({
        type: 'host/browser-screencast' as const,
        data: 'Zg==',
        width: 1,
        height: 1,
      }),
    },
  } as unknown as ApiProxy
}

describe('openApiProxyDownlink', () => {
  it('routes terminalStream and browserWatchScreencast query paths onto Host streams', async () => {
    const api = fakeApi()
    const signal = new AbortController().signal
    const terminal = await collect(openApiProxyDownlink(
      api,
      `${TERMINAL_STREAM_PATH}?workspaceId=ws1&sessionId=sess-1`,
      signal,
    ))
    const screencast = await collect(openApiProxyDownlink(
      api,
      `${BROWSER_WATCH_SCREENCAST_PATH}?workspaceId=ws1&tabId=tab-1`,
      signal,
    ))
    expect(terminal[0]?.payload).toMatchObject({ type: 'host/terminal-scrollback', text: 'hi' })
    expect(screencast[0]?.payload).toMatchObject({ type: 'host/browser-screencast', width: 1 })
  })

  it('routes mux, host, and watchPath paths', async () => {
    const api = fakeApi()
    const signal = new AbortController().signal
    const mux = await collect(openApiProxyDownlink(api, MUX_EVENTS_PATH, signal))
    const host = await collect(openApiProxyDownlink(api, HOST_EVENTS_PATH, signal))
    const watch = await collect(openApiProxyDownlink(
      api,
      `${WATCH_PATH_PATH}?workspaceId=ws1&path=${encodeURIComponent('/w/a.ts')}`,
      signal,
    ))
    expect(mux[0]?.payload).toMatchObject({ type: 'session/subscribed' })
    expect(host[0]?.payload).toMatchObject({ type: 'host/session-removed' })
    expect(watch[0]?.payload).toMatchObject({ type: 'host/watch-path-ready' })
  })

  it('rejects missing query fields and unknown pathnames', () => {
    const api = fakeApi()
    const signal = new AbortController().signal
    expect(() => openApiProxyDownlink(api, TERMINAL_STREAM_PATH, signal))
      .toThrow('missing or invalid workspaceId or sessionId query parameter')
    expect(() => openApiProxyDownlink(api, BROWSER_WATCH_SCREENCAST_PATH, signal))
      .toThrow('missing or invalid workspaceId or tabId query parameter')
    expect(() => openApiProxyDownlink(api, WATCH_PATH_PATH, signal))
      .toThrow('missing or invalid workspaceId or path query parameter')
    expect(() => openApiProxyDownlink(api, '/api/host.unknown', signal))
      .toThrow('unsupported IPC downlink path: /api/host.unknown')
  })
})
