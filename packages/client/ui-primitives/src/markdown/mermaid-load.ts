/** Mermaid loader for settled markdown fences. */

import mermaid from 'mermaid'

/** Mermaid HTML-sanitizer mode for diagram source. */
export type MermaidSecurityLevel = 'strict' | 'loose' | 'sandbox'

/** Mermaid theme + security options applied before each render. */
interface MermaidConfig {
  securityLevel: MermaidSecurityLevel
  theme: 'dark' | 'neutral'
  themeVariables: Readonly<Record<string, string>>
}

let initialized = false
let configured: MermaidConfig | undefined
let renderQueue: Promise<unknown> = Promise.resolve()

/**
 * Load Mermaid with one shared initialize pass.
 * @returns the Mermaid API.
 */
export function loadMermaid(): Promise<typeof mermaid> {
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      maxEdges: 2000,
    })
    initialized = true
  }
  return Promise.resolve(mermaid)
}

/**
 * Theme id aligned with Harness light/dark document state.
 * @returns Mermaid theme name for the current document.
 */
export function mermaidTheme(): 'dark' | 'neutral' {
  return typeof document !== 'undefined' && document.body.hasAttribute('data-ds-dark-theme')
    ? 'dark'
    : 'neutral'
}

/** Resolve one Harness token to a color Mermaid can bake into SVG output. */
function readCssColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.body).getPropertyValue(token).trim()
  return value === '' ? fallback : value
}

/**
 * Theme variables aligned with Harness light/dark tokens.
 * State-diagram notes default to mid-gray (#666) in neutral theme; override them here.
 * @returns Mermaid themeVariables for the current document theme.
 */
export function mermaidThemeVariables(): Record<string, string> {
  const dark = mermaidTheme() === 'dark'
  const label = readCssColor('--dsw-alias-label-primary', dark ? '#f9fafb' : '#111827')
  const secondary = readCssColor('--dsw-alias-label-secondary', dark ? '#d1d5db' : '#4b5563')
  const noteFill = readCssColor('--dsw-alias-fill-secondary', dark ? '#374151' : '#f3f4f6')
  const noteBorder = readCssColor('--dsw-alias-border-l2', dark ? '#4b5563' : '#d1d5db')
  const nodeFill = readCssColor('--dsw-alias-fill-tertiary', dark ? '#1f2937' : '#ffffff')
  const nodeBorder = readCssColor('--dsw-alias-border-l3', dark ? '#6b7280' : '#d1d5db')
  return {
    fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    textColor: label,
    lineColor: secondary,
    primaryColor: nodeFill,
    primaryTextColor: label,
    primaryBorderColor: nodeBorder,
    secondaryColor: noteFill,
    tertiaryColor: noteFill,
    noteBkgColor: noteFill,
    noteTextColor: label,
    noteBorderColor: noteBorder,
  }
}

function sameThemeVariables(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => left[key] === right[key])
}

/**
 * Apply per-render Mermaid options without resetting diagram state.
 * @param securityLevel - sanitizer mode for this diagram.
 */
export function configureMermaid(securityLevel: MermaidSecurityLevel): void {
  const next: MermaidConfig = {
    securityLevel,
    theme: mermaidTheme(),
    themeVariables: mermaidThemeVariables(),
  }
  if (
    configured !== undefined
    && configured.securityLevel === next.securityLevel
    && configured.theme === next.theme
    && sameThemeVariables(configured.themeVariables, next.themeVariables)
  ) {
    return
  }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: next.securityLevel,
    theme: next.theme,
    themeVariables: next.themeVariables,
    maxEdges: 2000,
  })
  configured = next
}

/**
 * Render one diagram through a shared queue so concurrent blocks do not race initialize().
 * @param id - unique render id for this diagram.
 * @param source - diagram source from the fence body.
 * @param securityLevel - sanitizer mode for this diagram.
 * @returns rendered SVG markup.
 */
export async function renderMermaidDiagram(
  id: string,
  source: string,
  securityLevel: MermaidSecurityLevel,
): Promise<string> {
  const task = renderQueue.then(async () => {
    await loadMermaid()
    configureMermaid(securityLevel)
    const result = await mermaid.render(id, source)
    return result.svg
  })
  renderQueue = task.catch(() => undefined)
  return task
}
