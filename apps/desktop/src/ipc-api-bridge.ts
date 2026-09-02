/**
 * Electron Main IPC carrier: maps Renderer requests to InProcess fetch handler.
 * @module @deepseek-ai/dsh-desktop-shell/ipc-api-bridge
 */

import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import { ipcMain } from 'electron'
import type { Context } from '@deepseek-ai/cordis'
import type { ApiProxy, RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy'
import { createHostApiFetchHandler, type HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import {
  IPC_API_FETCH,
  IPC_API_FETCH_CANCEL,
  IPC_API_STREAM_CLOSE,
  IPC_API_STREAM_END,
  IPC_API_STREAM_FRAME,
  IPC_API_STREAM_OPEN,
  IPC_API_STREAM_OPENED,
} from './ipc-contract.ts'
import { openApiProxyDownlink } from './ipc-downlink.ts'

type DownlinkFrame = import('@deepseek-ai/dsh-host-apiproxy/api').MuxFrame
  | import('@deepseek-ai/dsh-host-apiproxy/api').HostFrame
  | import('@deepseek-ai/dsh-host-apiproxy/api').WatchPathFrame
  | import('@deepseek-ai/dsh-host-apiproxy/api').TerminalStreamFrame
  | import('@deepseek-ai/dsh-host-apiproxy/api').BrowserScreencastFrame

function toServerRequestWire(frame: RpcRequest<DownlinkFrame>) {
  return {
    type: 'server-request' as const,
    rpcId: frame.rpcId,
    method: frame.payload.type,
    payload: frame.payload,
  }
}

/** In-flight uplink abort controllers keyed by Renderer `requestId`. */
const fetchAborters = new Map<string, AbortController>()

/** Active downlink pumps keyed by Renderer `streamId`. */
const streamAborters = new Map<string, AbortController>()

/**
 * Register IPC handlers that forward Renderer RPC through the same Host `/api`
 * transport as loopback HTTP (Typert Gateway intercept + ApiProxy fallback).
 * @param ctx - booted Host Cordis context.
 * @returns disposer removing IPC handlers and aborting live streams.
 */
export function registerIpcApiBridge(ctx: Context): () => void {
  const connection = ctx.get('connection') as HostConnectionService | undefined
  if (connection === undefined) {
    throw new Error('desktop IPC bridge requires ctx.connection from the Host connection plugin')
  }
  const handler = createHostApiFetchHandler(ctx, connection)
  const api = ctx.get('apiProxy') as ApiProxy | undefined
  if (api === undefined) {
    throw new Error('desktop IPC bridge requires ctx.apiProxy from the booted Host')
  }
  ipcMain.handle(IPC_API_FETCH, async (event, request: {
    requestId: string
    path: string
    method: string
    body?: string
  }) => {
    const abort = new AbortController()
    fetchAborters.set(request.requestId, abort)
    try {
      const response = await handler.fetch(new Request(new URL(request.path, 'http://dsh.internal'), {
        method: request.method,
        ...request.body === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: request.body },
        signal: abort.signal,
      }))
      return { status: response.status, body: await response.text() }
    } finally {
      fetchAborters.delete(request.requestId)
    }
  })
  ipcMain.on(IPC_API_FETCH_CANCEL, (_event, requestId: string) => {
    fetchAborters.get(requestId)?.abort()
  })
  ipcMain.handle(IPC_API_STREAM_OPEN, async (event, streamId: string, path: string) => {
    if (streamAborters.has(streamId)) return
    const abort = new AbortController()
    streamAborters.set(streamId, abort)
    void pumpDownlink(event.sender, streamId, path, api, abort)
      .finally(() => { streamAborters.delete(streamId) })
  })
  ipcMain.on(IPC_API_STREAM_CLOSE, (_event, streamId: string) => {
    streamAborters.get(streamId)?.abort()
  })
  return () => {
    ipcMain.removeHandler(IPC_API_FETCH)
    ipcMain.removeHandler(IPC_API_STREAM_OPEN)
    ipcMain.removeAllListeners(IPC_API_FETCH_CANCEL)
    ipcMain.removeAllListeners(IPC_API_STREAM_CLOSE)
    for (const abort of fetchAborters.values()) abort.abort()
    fetchAborters.clear()
    for (const abort of streamAborters.values()) abort.abort()
    streamAborters.clear()
  }
}

async function pumpDownlink(
  sender: WebContents,
  streamId: string,
  path: string,
  api: ApiProxy,
  abort: AbortController,
): Promise<void> {
  const signal = abort.signal
  try {
    const frames = openApiProxyDownlink(api, path, signal)
    sender.send(IPC_API_STREAM_OPENED, streamId)
    for await (const frame of frames) {
      if (signal.aborted) return
      sender.send(IPC_API_STREAM_FRAME, streamId, JSON.stringify(toServerRequestWire(frame)))
    }
  } catch (error) {
    if (!signal.aborted) {
      sender.send(
        IPC_API_STREAM_FRAME,
        streamId,
        JSON.stringify(toServerRequestWire({
          rpcId: RpcId(randomUUID()),
          payload: { type: 'stream/error', error: { code: 'internal', message: String(error), details: {} } },
        })),
      )
    }
  } finally {
    sender.send(IPC_API_STREAM_END, streamId)
    abort.abort()
  }
}
