/** Fake Main IPC bridge backed by an in-process fetch handler (test seam). */

import type { DesktopIpcBridge, DesktopIpcFetchRequest } from '../src/client/ipc-bridge.ts'

type Listener<T extends unknown[]> = (...args: T) => void

/** Test bridge with stream abort helper. */
export type HandlerBackedIpcBridge = DesktopIpcBridge & {
  abortAllStreams(): void
}

/**
 * Build a Renderer-side bridge that forwards through `handler.fetch`, mirroring
 * Electron Main's IPC carrier wiring in tests.
 * @param handler - typically `toFetchHandler(api)`.
 * @returns a {@link DesktopIpcBridge} implementation.
 */
export function createHandlerBackedIpcBridge(handler: { fetch: typeof fetch }): HandlerBackedIpcBridge {
  const fetchAborters = new Map<string, AbortController>()
  const streamAborters = new Map<string, AbortController>()
  const openedListeners = new Set<Listener<[string]>>()
  const frameListeners = new Set<Listener<[string, string]>>()
  const endListeners = new Set<Listener<[string]>>()

  return {
    delivery: 'desktop',
    abortAllStreams() {
      for (const abort of streamAborters.values()) abort.abort()
    },
    async fetch(request: DesktopIpcFetchRequest) {
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
    },
    cancelFetch(requestId) {
      fetchAborters.get(requestId)?.abort()
    },
    async openStream(streamId, path) {
      if (streamAborters.has(streamId)) return
      const abort = new AbortController()
      streamAborters.set(streamId, abort)
      void pumpStream(handler, streamId, path, abort.signal, openedListeners, frameListeners, endListeners)
        .finally(() => { streamAborters.delete(streamId) })
    },
    closeStream(streamId) {
      streamAborters.get(streamId)?.abort()
    },
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

async function pumpStream(
  handler: { fetch: typeof fetch },
  streamId: string,
  path: string,
  signal: AbortSignal,
  openedListeners: Set<Listener<[string]>>,
  frameListeners: Set<Listener<[string, string]>>,
  endListeners: Set<Listener<[string]>>,
): Promise<void> {
  const emit = <T extends unknown[]>(listeners: Set<Listener<T>>, ...args: T): void => {
    for (const listener of listeners) listener(...args)
  }
  try {
    const response = await handler.fetch(new Request(new URL(path, 'http://dsh.internal'), { signal }))
    if (!response.ok || response.body === null) throw new Error(`stream open failed: HTTP ${response.status}`)
    emit(openedListeners, streamId)
    for await (const data of readSseDataLines(response)) {
      if (signal.aborted) return
      emit(frameListeners, streamId, data)
    }
  } finally {
    emit(endListeners, streamId)
  }
}

async function *readSseDataLines(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = chunk.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('')
        if (data !== '') yield data
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}
