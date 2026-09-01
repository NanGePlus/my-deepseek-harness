/**
 * Map Renderer IPC stream paths onto Host ApiProxy downlinks (no Electron).
 * Unary IPC fetch awaits `response.text()`, so SSE paths must not use it.
 * @module @deepseek-ai/dsh-desktop-shell/ipc-downlink
 */

import { randomUUID } from 'node:crypto'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy'
import {
  hostBrowserWatchScreencastQuerySchema,
  hostTerminalStreamQuerySchema,
  hostWatchPathQuerySchema,
} from '@deepseek-ai/dsh-host-apiproxy/api/host.schema'
import {
  BROWSER_WATCH_SCREENCAST_PATH,
  HOST_EVENTS_PATH,
  MUX_EVENTS_PATH,
  TERMINAL_STREAM_PATH,
  WATCH_PATH_PATH,
} from './ipc-contract.ts'

/**
 * Open the Host stream for one IPC downlink pathname plus query.
 * @param api - booted Host ApiProxy.
 * @param path - Renderer `openStream` path, including query string.
 * @param signal - abort when the Renderer closes the stream.
 * @returns the matching Host stream.
 */
export function openApiProxyDownlink(api: ApiProxy, path: string, signal: AbortSignal) {
  const url = new URL(path, 'http://dsh.internal')
  if (url.pathname === MUX_EVENTS_PATH) {
    return api.events.mux({ rpcId: RpcId(randomUUID()), payload: {} }, signal)
  }
  if (url.pathname === HOST_EVENTS_PATH) {
    return api.events.host({ rpcId: RpcId(randomUUID()), payload: {} }, signal)
  }
  if (url.pathname === WATCH_PATH_PATH) {
    const parsed = hostWatchPathQuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) throw new Error('missing or invalid workspaceId or path query parameter')
    return api.host.watchPath({ rpcId: RpcId(randomUUID()), payload: parsed.data }, signal)
  }
  if (url.pathname === TERMINAL_STREAM_PATH) {
    const parsed = hostTerminalStreamQuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) throw new Error('missing or invalid workspaceId or sessionId query parameter')
    return api.host.terminalStream({ rpcId: RpcId(randomUUID()), payload: parsed.data }, signal)
  }
  if (url.pathname === BROWSER_WATCH_SCREENCAST_PATH) {
    const parsed = hostBrowserWatchScreencastQuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) throw new Error('missing or invalid workspaceId or tabId query parameter')
    return api.host.browserWatchScreencast({ rpcId: RpcId(randomUUID()), payload: parsed.data }, signal)
  }
  throw new Error(`unsupported IPC downlink path: ${url.pathname}`)
}
