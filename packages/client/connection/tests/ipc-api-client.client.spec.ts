/**
 * IpcApiClient protocol isomorphism: fake Main handler + Renderer carrier
 * must match InProcessApiClient results on the same ApiProxy script.
 */
import { describe, expect, it, vi } from 'vitest'
import { InProcessApiClient, toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import type { ApiProxy, HostFrame, MuxFrame, RpcRequest, WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api'
import { readDesktopIpcBridge } from '../src/client/ipc-bridge.ts'
import type { DesktopIpcBridge } from '../src/client/ipc-bridge.ts'
import { IpcApiClient } from '../src/client/ipc-api-client.ts'
import { ConnectionController } from '../src/client/connection.ts'
import { BROWSER_WATCH_SCREENCAST_PATH, TERMINAL_STREAM_PATH } from '../src/api-path.ts'
import { createHandlerBackedIpcBridge } from './ipc-bridge-fixture.client.ts'

function fakeApi(): ApiProxy {
  const muxFrames: MuxFrame[] = [{ type: 'session/subscribed', sessionId: 's1' as never, lastSeq: -1 }]
  const hostFrames: HostFrame[] = [{ type: 'host/session-removed', sessionId: 's1' as never }]
  async function *stream<F>(frames: F[], signal: AbortSignal): AsyncGenerator<RpcRequest<F>> {
    for (const payload of frames) {
      if (signal.aborted) return
      yield { rpcId: RpcId(`frame-${frames.indexOf(payload)}`), payload }
    }
  }
  return {
    host: {
      describe: (request: RpcRequest<Record<string, never>>) => Promise.resolve({
        rpcId: request.rpcId,
        result: { ok: true, value: { version: '0', cwd: '/fixture', attachedSessions: 1, canOpenPath: true } },
      }),
    },
    events: {
      mux: (_request: RpcRequest<Record<string, never>>, signal: AbortSignal) => stream(muxFrames, signal),
      host: (_request: RpcRequest<Record<string, never>>, signal: AbortSignal) => stream(hostFrames, signal),
    },
    respond: (message: { rpcId: RpcId }) => Promise.resolve({ accepted: true, rpcId: message.rpcId }),
  } as unknown as ApiProxy
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) items.push(item)
  return items
}

/** ApiProxy whose mux/host streams stay open until aborted (connection lifecycle tests). */
function fakeApiWithPersistentStreams(): ApiProxy {
  const api = fakeApi()
  async function *persistent<F>(frames: F[], signal: AbortSignal): AsyncGenerator<RpcRequest<F>> {
    for (const payload of frames) {
      if (signal.aborted) return
      yield { rpcId: RpcId(`frame-${frames.indexOf(payload)}`), payload }
    }
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => { resolve() }, { once: true })
    })
  }
  api.events.mux = (_request, signal) => persistent([{ type: 'session/subscribed', sessionId: 's1' as never, lastSeq: -1 }], signal)
  api.events.host = (_request, signal) => persistent([{ type: 'host/session-removed', sessionId: 's1' as never }], signal)
  return api
}

/**
 * Main unary fetch awaits `response.text()`, so SSE never completes.
 * Terminal and screencast must use `openStream` instead.
 */
function hangingFetchStreamBridge(): DesktopIpcBridge & { fetchPaths: string[]; streamPaths: string[] } {
  const fetchPaths: string[] = []
  const streamPaths: string[] = []
  const openedListeners = new Set<(id: string) => void>()
  const frameListeners = new Set<(id: string, data: string) => void>()
  const endListeners = new Set<(id: string) => void>()
  return {
    delivery: 'desktop',
    fetchPaths,
    streamPaths,
    fetch(request) {
      fetchPaths.push(request.path)
      return new Promise(() => undefined)
    },
    cancelFetch() {},
    async openStream(streamId, path) {
      streamPaths.push(path)
      const payload = path.startsWith(TERMINAL_STREAM_PATH)
        ? { type: 'host/terminal-scrollback' as const, text: 'hi', truncated: false }
        : { type: 'host/browser-screencast' as const, data: 'Zg==', width: 1, height: 1 }
      const wire = JSON.stringify({
        type: 'server-request',
        rpcId: 'frame-1',
        method: payload.type,
        payload,
      })
      queueMicrotask(() => {
        for (const listener of openedListeners) listener(streamId)
        for (const listener of frameListeners) listener(streamId, wire)
        for (const listener of endListeners) listener(streamId)
      })
    },
    closeStream() {},
    onStreamOpened(listener) {
      openedListeners.add(listener)
      return () => { openedListeners.delete(listener) }
    },
    onStreamFrame(listener) {
      frameListeners.add(listener)
      return () => { frameListeners.delete(listener) }
    },
    onStreamEnd(listener) {
      endListeners.add(listener)
      return () => { endListeners.delete(listener) }
    },
  }
}

describe('IpcApiClient protocol isomorphism', () => {
  it('unary host.describe matches InProcessApiClient on the same handler', async () => {
    const handler = toFetchHandler(fakeApi())
    const inProcess = new InProcessApiClient(handler)
    const ipc = new IpcApiClient(createHandlerBackedIpcBridge(handler))
    const baseline = await inProcess.host.describe({})
    const overIpc = await ipc.host.describe({})
    expect(overIpc.result).toEqual(baseline.result)
  })

  it('mux and host downlinks preserve frame order and schema', async () => {
    const handler = toFetchHandler(fakeApi())
    const ipc = new IpcApiClient(createHandlerBackedIpcBridge(handler))
    const ac = new AbortController()
    const mux = await collect(ipc.events.mux({}, ac.signal))
    const host = await collect(ipc.events.host({}, ac.signal))
    expect(mux.map(frame => frame.payload.type)).toEqual(['session/subscribed'])
    expect(host.map(frame => frame.payload.type)).toEqual(['host/session-removed'])
    expect(mux[0]?.payload).toMatchObject({ type: 'session/subscribed', sessionId: 's1' })
  })

  it('terminalStream and browserWatchScreencast ride openStream, not hanging unary fetch', async () => {
    const bridge = hangingFetchStreamBridge()
    const ipc = new IpcApiClient(bridge)
    const ac = new AbortController()
    const opened: string[] = []
    const terminal = await collect(ipc.host.terminalStream(
      { workspaceId: 'ws1' as WorkspaceId, sessionId: 'sess-1' },
      ac.signal,
      () => { opened.push('terminal') },
    ))
    const screencast = await collect(ipc.host.browserWatchScreencast(
      { workspaceId: 'ws1' as WorkspaceId, tabId: 'tab-1' },
      ac.signal,
      () => { opened.push('screencast') },
    ))
    expect(bridge.fetchPaths).toEqual([])
    expect(bridge.streamPaths).toEqual([
      `${TERMINAL_STREAM_PATH}?workspaceId=ws1&sessionId=sess-1`,
      `${BROWSER_WATCH_SCREENCAST_PATH}?workspaceId=ws1&tabId=tab-1`,
    ])
    expect(opened).toEqual(['terminal', 'screencast'])
    expect(terminal[0]?.payload).toMatchObject({ type: 'host/terminal-scrollback', text: 'hi', truncated: false })
    expect(screencast[0]?.payload).toMatchObject({ type: 'host/browser-screencast', width: 1, height: 1 })
  })

  it('stream loss triggers ConnectionController reconnect with backoff', async () => {
    const handler = toFetchHandler(fakeApiWithPersistentStreams())
    const bridge = createHandlerBackedIpcBridge(handler)
    const api = new IpcApiClient(bridge)
    let connected = 0
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const controller = new ConnectionController(api, { onConnected: () => { connected++ } }, {
      backoffBaseMs: 10, backoffFactor: 1, backoffMaxMs: 10, streamOpenTimeoutMs: 500,
    })
    controller.start()
    try {
      await vi.waitFor(() => { expect(connected).toBe(1) })
      bridge.abortAllStreams()
      await vi.waitFor(() => { expect(connected).toBe(2) })
    } finally {
      controller.stop()
      warnSpy.mockRestore()
    }
  })
})

describe('readDesktopIpcBridge', () => {
  it('returns the bridge when preload exposes fetch and openStream', () => {
    const handler = toFetchHandler(fakeApi())
    ;(globalThis as { dsh?: unknown }).dsh = createHandlerBackedIpcBridge(handler)
    expect(readDesktopIpcBridge()?.delivery).toBe('desktop')
    delete (globalThis as { dsh?: unknown }).dsh
  })

  it('returns undefined for attach-mode preload without IPC methods', () => {
    ;(globalThis as { dsh?: { delivery: string } }).dsh = { delivery: 'desktop' }
    expect(readDesktopIpcBridge()).toBeUndefined()
    delete (globalThis as { dsh?: unknown }).dsh
  })
})
