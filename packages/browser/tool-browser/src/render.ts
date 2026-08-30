/**
 * Model-facing summaries for browser tools.
 * @module @deepseek-ai/dsh-tool-browser/render
 */

import type {
  BrowserListResult,
  BrowserPageMetadata,
} from '@deepseek-ai/dsh-host-apiproxy/api/host.ts'

/** One-line navigate summary for the model and generic cards. */
export function renderNavigateSummary(meta: BrowserPageMetadata, url: string): string {
  const title = meta.title.length > 0 ? meta.title : meta.url
  return `navigated to ${url} (${title})`
}

/** One-line click summary. */
export function renderClickSummary(x: number, y: number): string {
  return `clicked at (${x}, ${y})`
}

/** One-line type summary. */
export function renderTypeSummary(text: string): string {
  const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text
  return `typed "${preview}"`
}

/** One-line scroll summary. */
export function renderScrollSummary(deltaX: number, deltaY: number): string {
  return `scrolled by (${deltaX}, ${deltaY})`
}

/** One-line select summary. */
export function renderSelectSummary(selector: string, values: readonly string[]): string {
  return `selected ${values.join(', ')} on ${selector}`
}

/** Format tab list for model output and generic cards. */
export function renderTabsSummary(result: BrowserListResult, action: string): string {
  if (action === 'list') {
    if (result.tabs.length === 0) return 'no browser tabs'
    return result.tabs.map((tab) => {
      const mark = tab.selected ? '*' : ' '
      const label = tab.title.length > 0 ? tab.title : tab.url
      return `${mark} ${tab.tabId}: ${label}`
    }).join('\n')
  }
  if (action === 'new') return 'opened new browser tab'
  if (action === 'select') return 'selected browser tab'
  return 'closed browser tab'
}

/** Bound snapshot tree text before spill policy runs. */
export function boundSnapshotTree(tree: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(tree, 'utf8')
  if (bytes <= maxBytes) return tree
  const notice = `\n[snapshot truncated at ${maxBytes} UTF-8 bytes]`
  const budget = maxBytes - Buffer.byteLength(notice, 'utf8')
  if (budget <= 0) return notice.trimStart()
  let end = tree.length
  while (end > 0 && Buffer.byteLength(tree.slice(0, end), 'utf8') > budget) end -= 1
  return `${tree.slice(0, end)}${notice}`
}
