/**
 * Vite dev config for `pnpm run dev:desktop`: allow serve and inject boot graph
 * from the file Electron Main writes after Host boot.
 */
import { readFileSync, watchFile, unwatchFile } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig, type Plugin } from 'vite'
import baseConfig from './vite.config.ts'
import { injectBootManifest } from '@deepseek-ai/dsh-client-modules'
import type { WebBootGraph } from '@deepseek-ai/dsh-client-modules'

const require = createRequire(import.meta.url)

function bootGraphPath(): string {
  return process.env.DSH_DESKTOP_BOOT_GRAPH_FILE
    ?? fileURLToPath(new URL('../../.sessions/desktop-boot-graph.json', import.meta.url))
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
  throw new Error(`desktop dev: ${pkgName} exports["./client"] must be a string or an object with a string default`)
}

function clientPathOf(id: string): string | undefined {
  let pkgPath: string
  try {
    pkgPath = require.resolve(`${id}/package.json`)
  } catch {
    return undefined
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
  const clientRel = clientExportOf(id, pkg.exports)
  return clientRel === undefined ? undefined : join(dirname(pkgPath), clientRel)
}

/** Map `/plugins/<id>/…` to a built client bundle path (mirrors client-modules host serving). */
function resolveDesktopDevPluginAssetPath(pathname: string): string | undefined {
  const prefix = '/plugins/'
  if (!pathname.startsWith(prefix)) return undefined
  const rest = pathname.slice(prefix.length)
  const mapSuffix = '/client.js.map'
  const bundleSuffix = '/client.js'
  const monacoPrefix = '/monaco/'
  if (rest.endsWith(mapSuffix)) {
    const clientPath = clientPathOf(rest.slice(0, -mapSuffix.length))
    return clientPath === undefined ? undefined : `${clientPath}.map`
  }
  if (rest.endsWith(bundleSuffix)) {
    return clientPathOf(rest.slice(0, -bundleSuffix.length))
  }
  const monacoIndex = rest.indexOf(monacoPrefix)
  if (monacoIndex >= 0) {
    const id = rest.slice(0, monacoIndex)
    const workerName = rest.slice(monacoIndex + monacoPrefix.length)
    if (workerName.includes('/') || workerName.includes('\\') || !/^[a-z0-9.-]+\.js$/i.test(workerName)) {
      return undefined
    }
    const clientPath = clientPathOf(id)
    return clientPath === undefined ? undefined : join(dirname(clientPath), 'monaco', workerName)
  }
  return undefined
}

/** Inject boot graph HTML and serve `/plugins/*` bundles for integrated desktop dev. */
function desktopDevBootGraphPlugin(): Plugin {
  let graph: WebBootGraph | undefined
  const path = bootGraphPath()
  const readGraph = (): void => {
    try {
      graph = JSON.parse(readFileSync(path, 'utf8')) as WebBootGraph
    } catch {
      graph = undefined
    }
  }
  readGraph()
  watchFile(path, { interval: 500 }, () => { readGraph() })
  return {
    name: 'dsh-desktop-dev-boot-graph',
    transformIndexHtml(html) {
      readGraph()
      return graph === undefined ? html : injectBootManifest(html, graph)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const pluginPath = resolveDesktopDevPluginAssetPath(url.pathname)
        if (pluginPath === undefined) return next()
        try {
          const body = readFileSync(pluginPath)
          const isSourceMap = url.pathname.endsWith('.map')
          res.setHeader('content-type', isSourceMap ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8')
          res.setHeader('cache-control', 'no-cache')
          res.end(body)
        } catch {
          res.statusCode = 404
          res.end()
        }
      })
    },
    buildEnd() {
      unwatchFile(path)
    },
  }
}

export default mergeConfig(baseConfig, defineConfig({
  plugins: [desktopDevBootGraphPlugin()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.DSH_DESKTOP_DEV_PORT ?? 5173),
    strictPort: true,
  },
}))
