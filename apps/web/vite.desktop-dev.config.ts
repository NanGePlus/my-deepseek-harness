/**
 * Vite dev config for `pnpm run dev:desktop`: allow serve and inject boot graph
 * from the file Electron Main writes after Host boot.
 */
import { readFileSync, watchFile, unwatchFile } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig, type Plugin } from 'vite'
import baseConfig from './vite.config.ts'
import { injectBootManifest } from '@deepseek-ai/dsh-client-modules'
import type { WebBootGraph } from '@deepseek-ai/dsh-client-modules'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

function bootGraphPath(): string {
  return process.env.DSH_DESKTOP_BOOT_GRAPH_FILE
    ?? fileURLToPath(new URL('../../.sessions/desktop-boot-graph.json', import.meta.url))
}

/** Inject `window.__DSH_BOOT__` from the desktop Host boot graph file. */
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
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/' && req.url !== '/index.html') return next()
        const indexPath = fileURLToPath(new URL('./index.html', import.meta.url))
        let html = readFileSync(indexPath, 'utf8')
        if (graph !== undefined) html = injectBootManifest(html, graph)
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end(html)
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
