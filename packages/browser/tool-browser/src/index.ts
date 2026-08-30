/**
 * Model-facing `browser_*` tools over Host `host.browser.*` RPC. Tools share the
 * Workspace-scoped Playwright registry with the embedded browser UI; they never
 * import Playwright directly.
 * @module @deepseek-ai/dsh-tool-browser
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-host-apiproxy'
import type {} from '@deepseek-ai/dsh-workspace'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  browserRequest,
  requireAgent,
  resolveTabId,
  resolveWorkspaceId,
  unwrapBrowserResponse,
} from './host-bridge.ts'
import {
  boundSnapshotTree,
  renderClickSummary,
  renderNavigateSummary,
  renderScrollSummary,
  renderSelectSummary,
  renderTabsSummary,
  renderTypeSummary,
} from './render.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-browser'
/** Required host gateway, workspace registry, tool registry, and prompt assembly. */
export const inject = ['apiProxy', 'workspaceRegistry', 'tools', 'systemPrompt']

/** Default cap on one complete browser_snapshot model-facing result (UTF-8 bytes). */
export const DEFAULT_SNAPSHOT_MAX_BYTES = 256 * 1024

/** Model-facing browser tool configuration. */
export interface Config {
  /** Maximum UTF-8 bytes in one complete browser_snapshot result. */
  snapshotMaxBytes?: number
}

/** Schemastery configuration for the browser tool consumer. */
export const Config: z<Config> = z.object({
  snapshotMaxBytes: z.number().step(1).min(1024).max(Number.MAX_SAFE_INTEGER)
    .default(DEFAULT_SNAPSHOT_MAX_BYTES),
})

interface TabRefArgs {
  tabId?: string
}

interface NavigateArgs extends TabRefArgs {
  url: string
}

interface ClickArgs extends TabRefArgs {
  x: number
  y: number
}

interface TypeArgs extends TabRefArgs {
  text: string
}

interface ScrollArgs extends TabRefArgs {
  deltaX?: number
  deltaY: number
}

interface SelectOptionArgs extends TabRefArgs {
  selector: string
  values: string[]
}

interface TabsArgs {
  action: 'list' | 'new' | 'select' | 'close'
  tabId?: string
  url?: string
}

function rawContentText(content: readonly ContentBlock[]): string | undefined {
  if (content.length !== 1) return undefined
  const block = content[0]
  return block?.type === 'text' ? block.text : undefined
}

function textResult(text: string): ContentBlock[] {
  return [{ type: 'text', text }]
}

/** Register all browser tools and usage guidance. */
export function apply(ctx: Context, config: Config = {}): void {
  const snapshotMaxBytes = config.snapshotMaxBytes ?? DEFAULT_SNAPSHOT_MAX_BYTES
  if (!Number.isSafeInteger(snapshotMaxBytes) || snapshotMaxBytes < 1024) {
    throw new Error('tool-browser: snapshotMaxBytes must be a safe integer of at least 1024')
  }

  ctx.systemPrompt.section({
    name: 'tool:browser',
    order: 107,
    text: 'Use browser_* tools to interact with the embedded browser that shares your Workspace tab state. Call browser_snapshot before click/type/select actions to read the accessibility tree. Human navigation in the toolbox does not appear in the session log; your browser_* calls do.',
  })

  const finalizeSnapshot: NonNullable<ToolDefinition['finalizeContent']> = (_exec, result) => {
    const raw = rawContentText(result.content)
    return raw === undefined ? undefined : textResult(boundSnapshotTree(raw, snapshotMaxBytes))
  }

  ctx.tools.register(defineTool({
    name: 'browser_navigate',
    description: 'Navigate the embedded browser to an http(s) URL on the current Workspace tab.',
    parameters: {
      url: { type: 'string', required: true, description: 'Destination URL (http:// or https://).' },
      tabId: { type: 'string', description: 'Target tab id from browser_tabs; defaults to the selected tab.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tabId: { type: 'string', required: true },
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
          canGoBack: { type: 'boolean', required: true },
          canGoForward: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: renderNavigateSummary(value, (args as NavigateArgs).url),
      }],
    },
    async execute(args: NavigateArgs, exec) {
      const agent = requireAgent(exec.agent)
      const workspaceId = resolveWorkspaceId(ctx, agent)
      const tabId = await resolveTabId(ctx.apiProxy, workspaceId, args.tabId, exec.signal)
      const meta = unwrapBrowserResponse(await ctx.apiProxy.host.browserNavigate(
        browserRequest({ workspaceId, tabId, url: args.url }),
        exec.signal,
      ))
      return { tabId, ...meta }
    },
    presentCall: args => ({
      card: 'generic',
      title: `Navigate to ${(args as NavigateArgs).url}`,
      kind: 'execute',
    }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_snapshot',
    description: 'Capture the accessibility tree for the current Workspace browser tab.',
    parameters: {
      tabId: { type: 'string', description: 'Target tab id; defaults to the selected tab.' },
    },
    finalizeContent: finalizeSnapshot,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tabId: { type: 'string', required: true },
          tree: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.tree }],
    },
    async execute(args: TabRefArgs, exec) {
      const agent = requireAgent(exec.agent)
      const workspaceId = resolveWorkspaceId(ctx, agent)
      const tabId = await resolveTabId(ctx.apiProxy, workspaceId, args.tabId, exec.signal)
      const snap = unwrapBrowserResponse(await ctx.apiProxy.host.browserSnapshot(
        browserRequest({ workspaceId, tabId }),
        exec.signal,
      ))
      return { tabId, tree: snap.tree }
    },
    presentCall: () => ({ card: 'generic', title: 'Browser snapshot', kind: 'read' }),
    presentResult(_args, result) {
      if (result.isError) return undefined
      const raw = rawContentText(result.content)
      return raw === undefined ? undefined : { card: 'terminal', title: 'Accessibility snapshot', output: raw }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_click',
    description: 'Click viewport coordinates on the embedded browser tab (screencast pixel space).',
    parameters: {
      tabId: { type: 'string', description: 'Target tab id; defaults to the selected tab.' },
      x: { type: 'number', required: true, description: 'Horizontal coordinate in the page viewport.' },
      y: { type: 'number', required: true, description: 'Vertical coordinate in the page viewport.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tabId: { type: 'string', required: true },
          clicked: { type: 'boolean', required: true, const: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: `${renderClickSummary((args as ClickArgs).x, (args as ClickArgs).y)} on tab ${value.tabId}`,
      }],
    },
    async execute(args: ClickArgs, exec) {
      const agent = requireAgent(exec.agent)
      const workspaceId = resolveWorkspaceId(ctx, agent)
      const tabId = await resolveTabId(ctx.apiProxy, workspaceId, args.tabId, exec.signal)
      unwrapBrowserResponse(await ctx.apiProxy.host.browserClick(
        browserRequest({ workspaceId, tabId, x: args.x, y: args.y }),
        exec.signal,
      ))
      return { tabId, clicked: true as const }
    },
    presentCall: args => ({
      card: 'generic',
      title: renderClickSummary((args as ClickArgs).x, (args as ClickArgs).y),
      kind: 'execute',
    }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_type',
    description: 'Type UTF-8 text into the focused element on the embedded browser tab.',
    parameters: {
      tabId: { type: 'string', description: 'Target tab id; defaults to the selected tab.' },
      text: { type: 'string', required: true, description: 'Text to type.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tabId: { type: 'string', required: true },
          typed: { type: 'boolean', required: true, const: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: `${renderTypeSummary((args as TypeArgs).text)} on tab ${value.tabId}`,
      }],
    },
    async execute(args: TypeArgs, exec) {
      const agent = requireAgent(exec.agent)
      const workspaceId = resolveWorkspaceId(ctx, agent)
      const tabId = await resolveTabId(ctx.apiProxy, workspaceId, args.tabId, exec.signal)
      unwrapBrowserResponse(await ctx.apiProxy.host.browserType(
        browserRequest({ workspaceId, tabId, text: args.text }),
        exec.signal,
      ))
      return { tabId, typed: true as const }
    },
    presentCall: args => ({
      card: 'generic',
      title: renderTypeSummary((args as TypeArgs).text),
      kind: 'execute',
      rawInput: (args as TypeArgs).text,
    }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_scroll',
    description: 'Scroll the embedded browser tab by pixel deltas.',
    parameters: {
      tabId: { type: 'string', description: 'Target tab id; defaults to the selected tab.' },
      deltaX: { type: 'number', description: 'Horizontal scroll delta in pixels (default 0).' },
      deltaY: { type: 'number', required: true, description: 'Vertical scroll delta in pixels.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tabId: { type: 'string', required: true },
          scrolled: { type: 'boolean', required: true, const: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: `${renderScrollSummary((args as ScrollArgs).deltaX ?? 0, (args as ScrollArgs).deltaY)} on tab ${value.tabId}`,
      }],
    },
    async execute(args: ScrollArgs, exec) {
      const agent = requireAgent(exec.agent)
      const workspaceId = resolveWorkspaceId(ctx, agent)
      const tabId = await resolveTabId(ctx.apiProxy, workspaceId, args.tabId, exec.signal)
      const deltaX = args.deltaX ?? 0
      unwrapBrowserResponse(await ctx.apiProxy.host.browserScroll(
        browserRequest({ workspaceId, tabId, deltaX, deltaY: args.deltaY }),
        exec.signal,
      ))
      return { tabId, scrolled: true as const }
    },
    presentCall: args => ({
      card: 'generic',
      title: renderScrollSummary((args as ScrollArgs).deltaX ?? 0, (args as ScrollArgs).deltaY),
      kind: 'execute',
    }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_select_option',
    description: 'Select option values on a `<select>` element in the embedded browser tab.',
    parameters: {
      tabId: { type: 'string', description: 'Target tab id; defaults to the selected tab.' },
      selector: { type: 'string', required: true, description: 'CSS selector for the select element.' },
      values: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: 'Option values to select.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tabId: { type: 'string', required: true },
          selected: { type: 'boolean', required: true, const: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: `${renderSelectSummary((args as SelectOptionArgs).selector, (args as SelectOptionArgs).values)} on tab ${value.tabId}`,
      }],
    },
    async execute(args: SelectOptionArgs, exec) {
      const agent = requireAgent(exec.agent)
      const workspaceId = resolveWorkspaceId(ctx, agent)
      const tabId = await resolveTabId(ctx.apiProxy, workspaceId, args.tabId, exec.signal)
      unwrapBrowserResponse(await ctx.apiProxy.host.browserSelectOption(
        browserRequest({ workspaceId, tabId, selector: args.selector, values: args.values }),
        exec.signal,
      ))
      return { tabId, selected: true as const }
    },
    presentCall: args => ({
      card: 'generic',
      title: renderSelectSummary((args as SelectOptionArgs).selector, (args as SelectOptionArgs).values),
      kind: 'execute',
    }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_tabs',
    description: 'List, open, select, or close embedded browser tabs for the current Workspace.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['list', 'new', 'select', 'close'],
        description: 'Tab operation to perform.',
      },
      tabId: { type: 'string', description: 'Tab id for select/close.' },
      url: { type: 'string', description: 'Initial URL when action is new.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', required: true },
          tabId: { type: 'string' },
          tabs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                tabId: { type: 'string', required: true },
                url: { type: 'string', required: true },
                title: { type: 'string', required: true },
                selected: { type: 'boolean', required: true },
                canGoBack: { type: 'boolean', required: true },
                canGoForward: { type: 'boolean', required: true },
              },
            },
          },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: value.tabs === undefined
          ? renderTabsSummary({ tabs: [] }, (args as TabsArgs).action)
          : renderTabsSummary({ tabs: value.tabs }, value.action),
      }],
    },
    async execute(args: TabsArgs, exec) {
      const agent = requireAgent(exec.agent)
      const workspaceId = resolveWorkspaceId(ctx, agent)
      if (args.action === 'list') {
        const list = unwrapBrowserResponse(await ctx.apiProxy.host.browserList(
          browserRequest({ workspaceId }),
          exec.signal,
        ))
        return { action: args.action, tabs: list.tabs }
      }
      if (args.action === 'new') {
        const created = unwrapBrowserResponse(await ctx.apiProxy.host.browserCreateTab(
          browserRequest({ workspaceId, ...args.url !== undefined ? { url: args.url } : {} }),
          exec.signal,
        ))
        return { action: args.action, tabId: created.tabId }
      }
      if (args.tabId === undefined || args.tabId.length === 0) {
        throw new Error('tabId is required for select and close actions')
      }
      if (args.action === 'select') {
        unwrapBrowserResponse(await ctx.apiProxy.host.browserSelectTab(
          browserRequest({ workspaceId, tabId: args.tabId }),
          exec.signal,
        ))
        return { action: args.action, tabId: args.tabId }
      }
      unwrapBrowserResponse(await ctx.apiProxy.host.browserCloseTab(
        browserRequest({ workspaceId, tabId: args.tabId }),
        exec.signal,
      ))
      return { action: args.action, tabId: args.tabId }
    },
    presentCall: args => ({
      card: 'generic',
      title: `Browser tabs: ${(args as TabsArgs).action}`,
      kind: 'execute',
    }),
  }))
}

export {
  boundSnapshotTree,
  renderClickSummary,
  renderNavigateSummary,
  renderScrollSummary,
  renderSelectSummary,
  renderTabsSummary,
  renderTypeSummary,
} from './render.ts'
export {
  BrowserHostError,
  browserRequest,
  requireAgent,
  resolveTabId,
  resolveWorkspaceId,
  unwrapBrowserResponse,
} from './host-bridge.ts'
