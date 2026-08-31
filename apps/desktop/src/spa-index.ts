/**
 * Build the desktop SPA index.html with Host boot wire and boot manifest injection.
 * @module @deepseek-ai/dsh-desktop-shell/spa-index
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { injectBootManifest } from '@deepseek-ai/dsh-client-modules'
import { composeDesktopBootGraph } from './boot-graph.ts'
import { hostBootFailureWire, hostBootSuccessWire, injectHostBootWire } from './host-boot-wire.ts'
import { DSH_APP_AUTHORITY, DSH_PROTOCOL_SCHEME } from './protocol-dsh.ts'

/** Inputs for composing desktop SPA index.html. */
export interface BuildDesktopSpaIndexHtmlInput {
  /** Root of the built web SPA (`apps/web/dist`). */
  distRoot: string
  /** Whether Main skipped integrated Host boot (attach mode). */
  skipHostBoot: boolean
  /** Whether integrated Host boot succeeded. */
  hostBooted: boolean
  /** Last integrated Host boot error message. */
  lastHostBootError?: string
  /** Booted Host context for manifest injection. */
  hostContext?: Context
  /** SPA authority prefix for boot graph bundle URLs. */
  spaAuthority?: string
}

/**
 * Compose index.html for desktop Renderer loading.
 * @param input - Host boot state and dist layout.
 * @returns HTML source with host boot wire and optional boot manifest.
 */
export function buildDesktopSpaIndexHtml(input: BuildDesktopSpaIndexHtmlInput): string {
  const indexPath = join(input.distRoot, 'index.html')
  let html = readFileSync(indexPath, 'utf8')
  const hostFailed = !input.skipHostBoot && !input.hostBooted
  html = injectHostBootWire(
    html,
    hostFailed
      ? hostBootFailureWire(input.lastHostBootError ?? 'Integrated Host boot failed')
      : hostBootSuccessWire(),
  )
  if (input.hostContext !== undefined) {
    const authority = input.spaAuthority ?? `${DSH_PROTOCOL_SCHEME}://${DSH_APP_AUTHORITY}`
    const bootGraph = composeDesktopBootGraph(input.hostContext, authority)
    html = injectBootManifest(html, bootGraph.graph)
  }
  return html
}
