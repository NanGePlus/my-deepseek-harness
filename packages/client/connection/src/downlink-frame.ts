/** Host downlink wire helper shared by WebSocket and IPC carriers. */

import type { BrowserScreencastFrame, HostFrame, MuxFrame, RpcRequest, ServerRequest, WatchPathFrame, TerminalStreamFrame } from '@deepseek-ai/dsh-host-apiproxy/api'

type DownlinkFrame = MuxFrame | HostFrame | WatchPathFrame | TerminalStreamFrame | BrowserScreencastFrame

/**
 * Wrap a typed host stream frame in the wire `ServerRequest` envelope.
 * @param frame - host stream item with rpcId and payload.
 * @returns JSON-serializable server request for Renderer parsing.
 */
export function toServerRequestWire(frame: RpcRequest<DownlinkFrame>): ServerRequest {
  return {
    type: 'server-request',
    rpcId: frame.rpcId,
    method: frame.payload.type,
    payload: frame.payload,
  }
}
