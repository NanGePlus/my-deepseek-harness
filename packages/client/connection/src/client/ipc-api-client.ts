/** Desktop IPC carrier: uplink invoke + Main→Renderer downlink event streams. */

import type { ApiProxy, HostFrame, MuxFrame, RpcRequest, ServerRequest, WatchPathFrame } from './api.ts'
import { AbstractApiClient } from './api.ts'
import type { DesktopIpcBridge } from './ipc-bridge.ts'
import { hostFrameSchema, muxFrameSchema } from '@deepseek-ai/dsh-host-apiproxy/api/events.schema'
import { watchPathFrameSchema } from '@deepseek-ai/dsh-host-apiproxy/api/host.schema'
import { serverRequestSchema } from '@deepseek-ai/dsh-host-apiproxy/api/rpc.schema'
import { HOST_EVENTS_PATH, MUX_EVENTS_PATH, WATCH_PATH_PATH } from '../api-path.ts'
import { randomUuid } from './random-uuid.ts'

type StreamItem<F> = { kind: 'frame'; envelope: RpcRequest<F> } | { kind: 'end' }
type FrameParser<F> = { parse(value: unknown): F }

/** Desktop platform subclass: unary/respond and stream open/close ride the preload IPC bridge. */
export class IpcApiClient extends AbstractApiClient {
  private streamGeneration = 0
  private readonly streamInboxes = new Map<string, {
    items: StreamItem<unknown>[]
    wake?: () => void
    parseFrame: (payload: unknown) => unknown
  }>()

  /** @param bridge - preload-exposed desktop IPC surface. */
  constructor(private readonly bridge: DesktopIpcBridge, timeoutMs?: number) {
    super(timeoutMs)
    this.bridge.onStreamOpened(this.handleStreamOpened.bind(this))
    this.bridge.onStreamFrame(this.handleStreamFrame.bind(this))
    this.bridge.onStreamEnd(this.handleStreamEnd.bind(this))
  }

  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    const signal = init?.signal ?? undefined
    const requestId = randomUuid()
    const body = typeof init?.body === 'string' ? init.body : undefined
    const pending = this.bridge.fetch({
      requestId,
      path: `${input.pathname}${input.search}`,
      method: init?.method ?? 'GET',
      ...body === undefined ? {} : { body },
    })
    if (signal === undefined) {
      return pending.then(({ status, body: text }) => new Response(text, { status }))
    }
    if (signal.aborted) return Promise.reject(abortError(signal))
    return new Promise((resolve, reject) => {
      const onAbort = (): void => {
        this.bridge.cancelFetch(requestId)
        reject(abortError(signal))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      pending
        .then(({ status, body: text }) => resolve(new Response(text, { status })), reject)
        .finally(() => { signal.removeEventListener('abort', onAbort) })
    })
  }

  protected override openMux(
    _payload: Parameters<ApiProxy['events']['mux']>[0]['payload'],
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<MuxFrame>> {
    return this.readIpcStream(MUX_EVENTS_PATH, signal, muxFrameSchema, onOpen)
  }

  protected override openHost(
    _payload: Parameters<ApiProxy['events']['host']>[0]['payload'],
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<HostFrame>> {
    return this.readIpcStream(HOST_EVENTS_PATH, signal, hostFrameSchema, onOpen)
  }

  protected override openWatchPath(
    payload: { workspaceId: Parameters<ApiProxy['host']['watchPath']>[0]['payload']['workspaceId']; path: string },
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<WatchPathFrame>> {
    const query = new URLSearchParams({ workspaceId: payload.workspaceId, path: payload.path })
    return this.readIpcStream(`${WATCH_PATH_PATH}?${query.toString()}`, signal, watchPathFrameSchema, onOpen)
  }

  private async *readIpcStream<F>(
    path: string,
    signal: AbortSignal,
    frameSchema: FrameParser<F>,
    onOpen?: () => void,
  ): AsyncGenerator<RpcRequest<F>> {
    const streamId = `stream-${this.streamGeneration++}-${randomUuid()}`
    const inbox: StreamItem<F>[] = []
    const slot: {
      items: StreamItem<unknown>[]
      wake?: () => void
      parseFrame: (payload: unknown) => unknown
    } = {
      items: inbox as StreamItem<unknown>[],
      parseFrame: (payload: unknown) => frameSchema.parse(payload),
    }
    const handleAbort = (): void => { this.bridge.closeStream(streamId) }
    this.streamInboxes.set(streamId, slot)
    signal.addEventListener('abort', handleAbort, { once: true })
    if (signal.aborted) handleAbort()
    let opened = false
    const openedListener = (id: string): void => {
      if (id !== streamId || opened) return
      opened = true
      onOpen?.()
    }
    const removeOpened = this.bridge.onStreamOpened(openedListener)
    try {
      await this.bridge.openStream(streamId, path)
      while (true) {
        while (inbox.length > 0) {
          const item = inbox.shift() as StreamItem<F>
          if (item.kind === 'end') return
          yield item.envelope
        }
        await new Promise<void>((resolve) => { slot.wake = resolve })
      }
    } finally {
      removeOpened()
      signal.removeEventListener('abort', handleAbort)
      this.streamInboxes.delete(streamId)
      this.bridge.closeStream(streamId)
    }
  }

  private handleStreamOpened(streamId: string): void {
    const slot = this.streamInboxes.get(streamId)
    if (slot === undefined) return
    slot.wake?.()
    delete slot.wake
  }

  private handleStreamFrame(streamId: string, data: string): void {
    const slot = this.streamInboxes.get(streamId)
    if (slot === undefined) return
    let full: ServerRequest
    let payload: unknown
    try {
      full = serverRequestSchema.parse(JSON.parse(data))
      payload = slot.parseFrame(full.payload)
    } catch (error) {
      console.error(`[client-connection] dropping malformed IPC downlink frame on ${streamId}:`, error)
      return
    }
    this.onEnvelope(full)
    slot.items.push({ kind: 'frame', envelope: { rpcId: full.rpcId, payload } })
    slot.wake?.()
    delete slot.wake
  }

  private handleStreamEnd(streamId: string): void {
    const slot = this.streamInboxes.get(streamId)
    if (slot === undefined) return
    slot.items.push({ kind: 'end' })
    slot.wake?.()
    delete slot.wake
  }
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  if (reason instanceof Error) return reason
  if (typeof reason === 'string') return new Error(reason)
  return new Error('This operation was aborted')
}
