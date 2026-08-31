/**
 * Desktop Main/preload IPC contract constants (SSOT: dsh-client-connection ipc-channels).
 * @module @deepseek-ai/dsh-desktop-shell/ipc-contract
 */

export const IPC_API_FETCH = 'dsh:api-fetch'
export const IPC_API_FETCH_CANCEL = 'dsh:api-fetch-cancel'
export const IPC_API_STREAM_OPEN = 'dsh:api-stream-open'
export const IPC_API_STREAM_CLOSE = 'dsh:api-stream-close'
export const IPC_API_STREAM_OPENED = 'dsh:api-stream-opened'
export const IPC_API_STREAM_FRAME = 'dsh:api-stream-frame'
export const IPC_API_STREAM_END = 'dsh:api-stream-end'

export const MUX_EVENTS_PATH = '/api/events.mux'
export const HOST_EVENTS_PATH = '/api/events.host'
export const WATCH_PATH_PATH = '/api/host.watchPath'
