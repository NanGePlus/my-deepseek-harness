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

export const IPC_EXIT_REQUEST = 'dsh:exit-request'
export const IPC_EXIT_GUARD_RESULT = 'dsh:exit-guard-result'
export const IPC_FOCUS_SETTINGS = 'dsh:focus-settings'
export const IPC_BROWSER_OCCUPANT_BOUNDS = 'dsh:browser-occupant-bounds'
export const IPC_OPEN_EMBEDDED_BROWSER = 'dsh:open-embedded-browser'
export const IPC_OPEN_EXTERNAL_URL = 'dsh:open-external-url'

export const MUX_EVENTS_PATH = '/api/events.mux'
export const HOST_EVENTS_PATH = '/api/events.host'
export const WATCH_PATH_PATH = '/api/host.watchPath'
export const TERMINAL_STREAM_PATH = '/api/host.terminalStream'
export const BROWSER_WATCH_SCREENCAST_PATH = '/api/host.browserWatchScreencast'
