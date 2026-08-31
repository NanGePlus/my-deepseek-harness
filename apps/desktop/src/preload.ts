/**
 * Electron preload: narrow IPC bridge for desktop delivery (#115 skeleton; #116 fills RPC).
 * @module @deepseek-ai/dsh-desktop-shell/preload
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dsh', {
  delivery: 'desktop',
  retryHostBoot: () => ipcRenderer.invoke('dsh:host-boot-retry'),
})
