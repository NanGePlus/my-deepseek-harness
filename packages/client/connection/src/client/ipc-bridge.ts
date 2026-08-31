/**
 * Typed desktop preload bridge for the IPC API carrier.
 * @module @deepseek-ai/dsh-client-connection/client/ipc-bridge
 */

/** One uplink POST through Main's in-process fetch handler. */
export interface DesktopIpcFetchRequest {
  /** Correlates with {@link DesktopIpcBridge.cancelFetch}. */
  requestId: string
  /** Absolute API pathname, optionally with query (e.g. `/api/host.describe`). */
  path: string
  /** HTTP method; unary/respond use `POST`. */
  method: string
  /** JSON request body for POST calls. */
  body?: string
}

/** Uplink fetch result returned to Renderer. */
export interface DesktopIpcFetchResponse {
  status: number
  body: string
}

/**
 * Narrow IPC surface exposed by Electron preload (`contextBridge`).
 * Renderer code must not assume Node or `ipcRenderer` directly.
 */
export interface DesktopIpcBridge {
  readonly delivery: 'desktop'
  fetch(request: DesktopIpcFetchRequest): Promise<DesktopIpcFetchResponse>
  cancelFetch(requestId: string): void
  openStream(streamId: string, path: string): Promise<void>
  closeStream(streamId: string): void
  onStreamOpened(listener: (streamId: string) => void): () => void
  onStreamFrame(listener: (streamId: string, data: string) => void): () => void
  onStreamEnd(listener: (streamId: string) => void): () => void
}

type DshPreload = DesktopIpcBridge & {
  retryHostBoot?: () => Promise<{ ok: boolean; error?: string }>
}

/**
 * Read the desktop IPC bridge when integrated delivery exposes it.
 * @returns the bridge or undefined in browser / attach / headless contexts.
 */
export function readDesktopIpcBridge(): DesktopIpcBridge | undefined {
  const bridge = (globalThis as { dsh?: DshPreload }).dsh
  if (bridge?.delivery !== 'desktop') return undefined
  if (typeof bridge.fetch !== 'function') return undefined
  if (typeof bridge.openStream !== 'function') return undefined
  return bridge
}
