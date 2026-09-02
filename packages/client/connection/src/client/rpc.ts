/** Generic Connection unary RPC callers for browser fetch and desktop IPC. */

import {
  RpcId,
  serverResponseSchema,
  type ClientRequest,
  type RpcResult,
} from '@deepseek-ai/dsh-host-apiproxy/api'
import type { ClientConnectionRpc } from '../rpc.ts'
import type { DesktopIpcBridge } from './ipc-bridge.ts'
import { randomUuid } from './random-uuid.ts'

const INTERNAL_BASE = 'http://dsh.internal'
const CHANNEL_PATTERN = /^\/[A-Za-z0-9._~-]+$/
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/

/**
 * Create the browser-backed generic RPC caller.
 * @returns caller that owns request correlation and response-envelope validation.
 */
export function createWebConnectionRpc(): ClientConnectionRpc {
  return {
    call: (channel, endpoint, payload, signal) => invokeConnectionRpc(
      (path, body, callSignal) => globalThis.fetch(
        new URL(path, resolveBase()),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          ...callSignal === undefined ? {} : { signal: callSignal },
        },
      ),
      channel,
      endpoint,
      payload,
      signal,
    ),
  }
}

/**
 * Create the desktop IPC-backed generic RPC caller.
 * Typert Remotes use the same `/api/<namespace>/<method>` envelope as loopback
 * fetch; integrated delivery must not fall back to Renderer `fetch`.
 * @param bridge - preload-exposed desktop IPC surface.
 * @returns caller that forwards through Main's in-process fetch handler.
 */
export function createIpcConnectionRpc(bridge: DesktopIpcBridge): ClientConnectionRpc {
  return {
    call: (channel, endpoint, payload, signal) => invokeConnectionRpc(
      (path, body, callSignal) => ipcFetchResponse(bridge, path, body, callSignal),
      channel,
      endpoint,
      payload,
      signal,
    ),
  }
}

async function invokeConnectionRpc(
  post: (path: string, body: string, signal?: AbortSignal) => Promise<Response>,
  channel: string,
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<RpcResult<unknown>> {
  assertTarget(channel, endpoint)
  const rpcId = RpcId(randomUuid())
  const message: ClientRequest = {
    type: 'client-request',
    rpcId,
    method: endpoint,
    payload,
  }
  const response = await post(`${channel}/${endpoint}`, JSON.stringify(message), signal)
  if (!response.ok) {
    throw new Error(`transport failure for ${channel}/${endpoint}: HTTP ${response.status}`)
  }
  const full = serverResponseSchema.parse(await response.json())
  if (full.rpcId !== rpcId) {
    throw new Error(`rpcId mismatch for ${endpoint}: sent ${rpcId}, got ${full.rpcId}`)
  }
  return full.result
}

async function ipcFetchResponse(
  bridge: DesktopIpcBridge,
  path: string,
  body: string,
  signal?: AbortSignal,
): Promise<Response> {
  const requestId = randomUuid()
  const pending = bridge.fetch({ requestId, path, method: 'POST', body })
  if (signal === undefined) {
    const { status, body: text } = await pending
    return new Response(text, { status })
  }
  if (signal.aborted) return Promise.reject(abortError(signal))
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      bridge.cancelFetch(requestId)
      reject(abortError(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    pending
      .then(({ status, body: text }) => resolve(new Response(text, { status })), reject)
      .finally(() => { signal.removeEventListener('abort', onAbort) })
  })
}

function resolveBase(): string {
  const location = (globalThis as { location?: { origin?: string } }).location
  return location?.origin !== undefined && location.origin !== 'null' ? location.origin : INTERNAL_BASE
}

function assertTarget(channel: string, endpoint: string): void {
  const segments = endpoint.split('/')
  if (!CHANNEL_PATTERN.test(channel)
    || segments.some(segment =>
      segment === '' || segment === '.' || segment === '..' || !ENDPOINT_SEGMENT_PATTERN.test(segment))) {
    throw new Error(`connection: invalid RPC target ${JSON.stringify(`${channel}/${endpoint}`)}`)
  }
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  if (reason instanceof Error) return reason
  if (typeof reason === 'string') return new Error(reason)
  return new Error('This operation was aborted')
}
