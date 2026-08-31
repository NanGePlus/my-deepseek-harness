/** Shared Electron IPC channel names for the desktop API carrier. */

/** Unary/respond POST carrier (`path`, `method`, `body`, `requestId`). */
export const IPC_API_FETCH = 'dsh:api-fetch'

/** Cancel an in-flight {@link IPC_API_FETCH} by `requestId`. */
export const IPC_API_FETCH_CANCEL = 'dsh:api-fetch-cancel'

/** Open a downlink stream (`streamId`, `path`). */
export const IPC_API_STREAM_OPEN = 'dsh:api-stream-open'

/** Close a downlink stream (`streamId`). */
export const IPC_API_STREAM_CLOSE = 'dsh:api-stream-close'

/** Main→Renderer: stream transport is readable (before first frame). */
export const IPC_API_STREAM_OPENED = 'dsh:api-stream-opened'

/** Main→Renderer: one `ServerRequest` JSON string (`streamId`, `data`). */
export const IPC_API_STREAM_FRAME = 'dsh:api-stream-frame'

/** Main→Renderer: stream ended (`streamId`). */
export const IPC_API_STREAM_END = 'dsh:api-stream-end'
