/**
 * Host browser RPC bridge for model-facing browser tools.
 * @module @deepseek-ai/dsh-tool-browser/host-bridge
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'

let nextRpc = 0

/** Mint one host.browser.* request envelope. */
export function browserRequest<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`tool-browser-${String(++nextRpc)}`), payload }
}

/** Raised when host.browser.* returns an error response. */
export class BrowserHostError extends Error {
  /**
   * @param message - Host RPC error message (user-visible).
   * @param code - Host RPC error code.
   */
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'BrowserHostError'
  }
}

/** Unwrap one host.browser.* success value or throw {@link BrowserHostError}. */
export function unwrapBrowserResponse<T>(response: RpcResponse<T>): T {
  if (response.result.ok) return response.result.value
  throw new BrowserHostError(response.result.error.message, response.result.error.code)
}

/**
 * Resolve the Workspace that owns the calling agent's session.
 * @param ctx - Cordis context with workspaceRegistry.
 * @param agent - initiating agent.
 * @returns workspace id for host.browser.* calls.
 */
export function resolveWorkspaceId(ctx: Context, agent: Agent): WorkspaceId {
  const workspaces = ctx.workspaceRegistry.list()
  const direct = workspaces.find(workspace => workspace.sessionIds.includes(agent.id))
  if (direct !== undefined) return direct.id
  throw new BrowserHostError(
    'browser tools require a session bound to a workspace',
    'workspace-not-found',
  )
}

/**
 * Resolve a tab id: explicit argument, the selected tab, the first tab, or a new about:blank tab.
 * @param api - host ApiProxy.
 * @param workspaceId - owning workspace.
 * @param tabId - optional explicit tab id from tool args.
 * @param signal - cooperative cancellation.
 * @returns tab id shared with the embedded browser UI.
 */
export async function resolveTabId(
  api: ApiProxy,
  workspaceId: WorkspaceId,
  tabId: string | undefined,
  signal: AbortSignal,
): Promise<string> {
  if (tabId !== undefined && tabId.length > 0) return tabId
  const list = unwrapBrowserResponse(await api.host.browserList(browserRequest({ workspaceId }), signal))
  const selected = list.tabs.find(tab => tab.selected) ?? list.tabs[0]
  if (selected !== undefined) return selected.tabId
  const created = unwrapBrowserResponse(
    await api.host.browserCreateTab(browserRequest({ workspaceId }), signal),
  )
  return created.tabId
}

/** Require an initiating agent on tool execution. */
export function requireAgent(agent: Agent | undefined): Agent {
  if (agent === undefined) throw new Error('browser tools require an initiating agent')
  return agent
}
