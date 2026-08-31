/**
 * Compose the desktop SPA boot graph from a booted Host loader scan.
 * @module @deepseek-ai/dsh-desktop-shell/boot-graph
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { WebBootEntry, WebBootGraph } from '@deepseek-ai/dsh-client-modules'

/** One client plugin row with its bundle path on disk. */
export interface DesktopBootBundle {
  id: string
  clientPath: string
}

/** Composed desktop boot manifest and bundle index. */
export interface DesktopBootComposition {
  graph: WebBootGraph
  bundles: Map<string, DesktopBootBundle>
}

/** sha1 content hash shortened to 12 hex chars (bundle rev / graph rev). */
function shortHash(input: string | Buffer): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12)
}

function parseDshClient(pkgName: string, value: unknown): { inject?: string[]; immediately: boolean } | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null) {
    throw new Error(`desktop boot-graph: ${pkgName} has a non-object dsh.client declaration`)
  }
  const decl = value as Record<string, unknown>
  if (typeof decl.platform !== 'string') {
    throw new Error(`desktop boot-graph: ${pkgName} dsh.client.platform must be a string`)
  }
  if (decl.platform !== 'web') return undefined
  if (decl.inject !== undefined && (!Array.isArray(decl.inject) || decl.inject.some(i => typeof i !== 'string'))) {
    throw new Error(`desktop boot-graph: ${pkgName} dsh.client.inject must be a string array`)
  }
  if (decl.immediately !== undefined && typeof decl.immediately !== 'boolean') {
    throw new Error(`desktop boot-graph: ${pkgName} dsh.client.immediately must be a boolean`)
  }
  return {
    ...(decl.inject !== undefined ? { inject: decl.inject as string[] } : {}),
    immediately: decl.immediately === true,
  }
}

function clientExportOf(pkgName: string, exportsField: unknown): string | undefined {
  if (typeof exportsField !== 'object' || exportsField === null) return undefined
  const client = (exportsField as Record<string, unknown>)['./client']
  if (client === undefined) return undefined
  if (typeof client === 'string') return client
  if (typeof client === 'object' && client !== null) {
    const fallback = (client as Record<string, unknown>).default
    if (typeof fallback === 'string') return fallback
  }
  throw new Error(`desktop boot-graph: ${pkgName} exports["./client"] must be a string or an object with a string default`)
}

function graphRow(
  id: string,
  rev: string,
  urlPrefix: string,
  injectEdges: string[] | undefined,
  immediately: boolean,
): WebBootEntry {
  return {
    id,
    url: `${urlPrefix}/plugins/${id}/client.js?rev=${rev}`,
    rev,
    ...(injectEdges !== undefined ? { inject: injectEdges } : {}),
    ...(immediately ? { immediately: true } : {}),
  }
}

/**
 * Scan active loader entries and compose a boot graph for desktop SPA loading.
 * @param ctx - booted desktop Host root context.
 * @param urlPrefix - URL prefix for plugin bundles (`dsh://app` or `http://127.0.0.1:PORT`).
 * @returns the wire graph and bundle paths keyed by entry id.
 */
export function composeDesktopBootGraph(ctx: Context, urlPrefix: string): DesktopBootComposition {
  if (ctx.baseUrl === undefined) throw new Error('desktop boot-graph: ctx.baseUrl is unset')
  const require = createRequire(ctx.baseUrl)
  const resolvePkgJson = (spec: string): string => require.resolve(`${spec}/package.json`)
  const bundles = new Map<string, DesktopBootBundle>()
  const entries: WebBootEntry[] = []

  for (const entry of ctx.loader.entries()) {
    if (entry.fiber === undefined || entry.disabled) continue
    const id = entry.options.name
    let pkgPath: string
    try {
      pkgPath = resolvePkgJson(id)
    } catch {
      continue
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    const dsh = pkg.dsh
    const decl = parseDshClient(
      id,
      dsh !== null && typeof dsh === 'object' ? (dsh as Record<string, unknown>).client : undefined,
    )
    if (decl === undefined) continue
    const clientRel = clientExportOf(id, pkg.exports)
    if (clientRel === undefined) {
      throw new Error(`desktop boot-graph: ${id} declares dsh.client but exports no "./client" bundle`)
    }
    const clientPath = join(dirname(pkgPath), clientRel)
    const rev = shortHash(readFileSync(clientPath))
    entries.push(graphRow(id, rev, urlPrefix, decl.inject, decl.immediately))
    bundles.set(id, { id, clientPath })
  }

  const graph: WebBootGraph = { rev: shortHash(JSON.stringify(entries)), entries }
  return { graph, bundles }
}
