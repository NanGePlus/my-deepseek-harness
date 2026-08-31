/**
 * Electron preload: narrow IPC bridge for desktop integrated Host delivery.
 * @module @deepseek-ai/dsh-desktop-shell/preload
 */

import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_API_FETCH,
  IPC_API_FETCH_CANCEL,
  IPC_API_STREAM_CLOSE,
  IPC_API_STREAM_END,
  IPC_API_STREAM_FRAME,
  IPC_API_STREAM_OPEN,
  IPC_API_STREAM_OPENED,
  IPC_EXIT_GUARD_RESULT,
  IPC_EXIT_REQUEST,
  IPC_FOCUS_SETTINGS,
  IPC_BROWSER_OCCUPANT_BOUNDS,
} from './ipc-contract.ts'

function subscribe(channel: string, listener: (...args: unknown[]) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => { listener(...args) }
  ipcRenderer.on(channel, handler)
  return () => { ipcRenderer.removeListener(channel, handler) }
}

const shell = {
  onExitRequest: (listener: () => void) => subscribe(IPC_EXIT_REQUEST, () => { listener() }),
  sendExitGuardResult: (result: { proceed: boolean }) => { ipcRenderer.send(IPC_EXIT_GUARD_RESULT, result) },
  onFocusSettings: (listener: () => void) => subscribe(IPC_FOCUS_SETTINGS, () => { listener() }),
  reportBrowserOccupantBounds: (bounds: {
    x: number
    y: number
    width: number
    height: number
    visible: boolean
  }) => { ipcRenderer.send(IPC_BROWSER_OCCUPANT_BOUNDS, bounds) },
}

const shared = {
  delivery: 'desktop' as const,
  retryHostBoot: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('dsh:host-boot-retry'),
  ...shell,
}

const attachMode = process.env.DSH_DESKTOP_ATTACH?.trim()

if (attachMode !== undefined && attachMode !== '') {
  contextBridge.exposeInMainWorld('dsh', shared)
} else {
  const bridge = {
    ...shared,
    fetch: request => ipcRenderer.invoke(IPC_API_FETCH, request),
    cancelFetch: (requestId) => { ipcRenderer.send(IPC_API_FETCH_CANCEL, requestId) },
    openStream: (streamId, path) => ipcRenderer.invoke(IPC_API_STREAM_OPEN, streamId, path),
    closeStream: (streamId) => { ipcRenderer.send(IPC_API_STREAM_CLOSE, streamId) },
    onStreamOpened: listener => subscribe(IPC_API_STREAM_OPENED, (...args) => { listener(String(args[0])) }),
    onStreamFrame: listener => subscribe(IPC_API_STREAM_FRAME, (...args) => { listener(String(args[0]), String(args[1])) }),
    onStreamEnd: listener => subscribe(IPC_API_STREAM_END, (...args) => { listener(String(args[0])) }),
  }
  contextBridge.exposeInMainWorld('dsh', bridge)
}
