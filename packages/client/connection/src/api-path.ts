/**
 * The /api URL prefix — single source for both halves of the web transport.
 * The node half registers this prefix on the web server; both halves share the
 * event paths below for the browser WebSocket downlinks.
 */

/** Route prefix owning every api request (`/api` and `/api/<anything>`). */
export const API_PATH = '/api'

/** Browser mux-frame WebSocket pathname. */
export const MUX_EVENTS_PATH = `${API_PATH}/events.mux`

/** Browser host-frame WebSocket pathname. */
export const HOST_EVENTS_PATH = `${API_PATH}/events.host`

/** Browser host.watchPath WebSocket pathname (query carries workspaceId and path). */
export const WATCH_PATH_PATH = `${API_PATH}/host.watchPath`

/** Browser host.terminalStream SSE pathname (query carries workspaceId and sessionId). */
export const TERMINAL_STREAM_PATH = `${API_PATH}/host.terminalStream`

/** Browser host.browserWatchScreencast SSE pathname (query carries workspaceId and tabId). */
export const BROWSER_WATCH_SCREENCAST_PATH = `${API_PATH}/host.browserWatchScreencast`
