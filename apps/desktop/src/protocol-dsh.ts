/**
 * dsh:// custom protocol: production SPA dist + plugin bundles.
 * @module @deepseek-ai/dsh-desktop-shell/protocol-dsh
 */

import { readFileSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { injectBootManifest } from '@deepseek-ai/dsh-client-modules'
import type { WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import type { DesktopBootBundle } from './boot-graph.ts'

/** Production SPA dist root (`apps/web/dist`). */
export const DSH_PROTOCOL_SCHEME = 'dsh'
export const DSH_APP_AUTHORITY = 'app'

/** Resolve a dsh://app/… request to a filesystem path, or undefined when unknown. */
export function resolveDshProtocolPath(
  distRoot: string,
  requestUrl: string,
  bootGraph?: WebBootGraph,
  bundles?: ReadonlyMap<string, DesktopBootBundle>,
): string | undefined {
  const url = new URL(requestUrl)
  if (url.protocol !== `${DSH_PROTOCOL_SCHEME}:` || url.hostname !== DSH_APP_AUTHORITY) return undefined
  const pathname = decodeURIComponent(url.pathname)
  if (pathname.startsWith('/plugins/')) {
    if (bundles === undefined) return undefined
    const rest = pathname.slice('/plugins/'.length)
    const bundleSuffix = '/client.js'
    const mapSuffix = '/client.js.map'
    if (rest.endsWith(mapSuffix)) {
      const id = rest.slice(0, -mapSuffix.length)
      const bundle = bundles.get(id)
      return bundle === undefined ? undefined : `${bundle.clientPath}.map`
    }
    if (rest.endsWith(bundleSuffix)) {
      const id = rest.slice(0, -bundleSuffix.length)
      return bundles.get(id)?.clientPath
    }
    return undefined
  }
  const relative = pathname === '/' ? '/index.html' : pathname
  const normalized = normalize(join(distRoot, relative))
  if (!normalized.startsWith(normalize(distRoot))) return undefined
  return normalized
}

/**
 * Read a dsh:// response body for a resolved filesystem path.
 * @param filePath - absolute path under dist or a plugin bundle.
 * @param bootGraph - when serving index.html, inject `window.__DSH_BOOT__`.
 * @returns UTF-8 body and MIME type.
 */
export function readDshProtocolAsset(
  filePath: string,
  bootGraph?: WebBootGraph,
): { body: string; mimeType: string } {
  let body = readFileSync(filePath, 'utf8')
  let mimeType = 'application/octet-stream'
  if (filePath.endsWith('.html')) {
    mimeType = 'text/html; charset=utf-8'
    if (bootGraph !== undefined) body = injectBootManifest(body, bootGraph)
  } else if (filePath.endsWith('.js')) {
    mimeType = 'text/javascript; charset=utf-8'
  } else if (filePath.endsWith('.css')) {
    mimeType = 'text/css; charset=utf-8'
  } else if (filePath.endsWith('.map')) {
    mimeType = 'application/json; charset=utf-8'
  }
  return { body, mimeType }
}

/** Default production renderer entry (`dsh://app/index.html`). */
export function productionSpaUrl(): string {
  return `${DSH_PROTOCOL_SCHEME}://${DSH_APP_AUTHORITY}/index.html`
}

/** Absolute path to the built SPA dist directory. */
export function resolveWebDistRoot(repoRoot: string): string {
  return join(repoRoot, 'apps/web/dist')
}

/** File URL of the Electron preload script. */
export function preloadFileUrl(repoRoot: string): string {
  return pathToFileURL(join(repoRoot, 'apps/desktop/lib/preload.js')).href
}

/** Normalize Windows paths for comparisons. */
export function isUnderRoot(root: string, candidate: string): boolean {
  const normalizedRoot = normalize(root)
  const normalizedCandidate = normalize(candidate)
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)
}
