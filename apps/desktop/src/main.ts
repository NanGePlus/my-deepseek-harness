/**
 * Electron Main: Host boot, dsh:// protocol, BrowserWindow lifecycle.
 * @module @deepseek-ai/dsh-desktop-shell/main
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy/api'
import { composeDesktopBootGraph } from './boot-graph.ts'
import { DesktopHostController } from './host-boot.ts'
import { registerIpcApiBridge } from './ipc-api-bridge.ts'
import { hostBootFailureWire, hostBootSuccessWire, injectHostBootWire } from './host-boot-wire.ts'
import { resolveDesktopLoadTarget, DEFAULT_DESKTOP_DEV_URL } from './load-url.ts'
import { shouldSkipHostBoot } from './attach.ts'
import {
  DSH_APP_AUTHORITY,
  DSH_PROTOCOL_SCHEME,
  preloadFileUrl,
  readDshProtocolAsset,
  resolveDshProtocolPath,
  resolveWebDistRoot,
} from './protocol-dsh.ts'
import { injectBootManifest } from '@deepseek-ai/dsh-client-modules'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const bootGraphFile = join(repoRoot, '.sessions/desktop-boot-graph.json')

protocol.registerSchemesAsPrivileged([
  {
    scheme: DSH_PROTOCOL_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])

const hostController = new DesktopHostController()
let mainWindow: BrowserWindow | undefined
let bootGraph: ReturnType<typeof composeDesktopBootGraph> | undefined
let lastHostBootError: string | undefined
let disposeIpcBridge: (() => void) | undefined

function distRoot(): string {
  return resolveWebDistRoot(repoRoot)
}

function writeDevBootGraph(): void {
  const ctx = hostController.context
  if (ctx === undefined) return
  mkdirSync(dirname(bootGraphFile), { recursive: true })
  bootGraph = composeDesktopBootGraph(ctx, 'http://127.0.0.1:5173')
  writeFileSync(bootGraphFile, `${JSON.stringify(bootGraph.graph, null, 2)}\n`)
}

async function bootIntegratedHost(): Promise<void> {
  if (shouldSkipHostBoot()) return
  try {
    await hostController.boot()
    lastHostBootError = undefined
    writeDevBootGraph()
    wireIpcApiBridge()
  } catch (error) {
    lastHostBootError = error instanceof Error ? error.message : String(error)
    console.error('desktop: Host boot failed:', lastHostBootError)
  }
}

function wireIpcApiBridge(): void {
  if (shouldSkipHostBoot()) return
  disposeIpcBridge?.()
  disposeIpcBridge = undefined
  const ctx = hostController.context
  if (ctx === undefined) return
  const api = ctx.get('apiProxy') as ApiProxy | undefined
  if (api === undefined) return
  disposeIpcBridge = registerIpcApiBridge(api)
}

function buildIndexHtml(): string {
  const indexPath = join(distRoot(), 'index.html')
  let html = readFileSync(indexPath, 'utf8')
  const hostFailed = !shouldSkipHostBoot() && !hostController.isBooted
  html = injectHostBootWire(
    html,
    hostFailed
      ? hostBootFailureWire(lastHostBootError ?? 'Integrated Host boot failed')
      : hostBootSuccessWire(),
  )
  if (hostController.context !== undefined) {
    bootGraph = composeDesktopBootGraph(hostController.context, `${DSH_PROTOCOL_SCHEME}://${DSH_APP_AUTHORITY}`)
    html = injectBootManifest(html, bootGraph.graph)
  }
  return html
}

function registerDshProtocol(): void {
  protocol.handle(DSH_PROTOCOL_SCHEME, async (request) => {
    if (request.url.includes('/index.html') || request.url.endsWith(`${DSH_APP_AUTHORITY}/`)) {
      return new Response(buildIndexHtml(), { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    const filePath = resolveDshProtocolPath(distRoot(), request.url, bootGraph?.graph, bootGraph?.bundles)
    if (filePath === undefined) return new Response('Not Found', { status: 404 })
    const asset = readDshProtocolAsset(filePath)
    return new Response(asset.body, { headers: { 'content-type': asset.mimeType } })
  })
}

function createMainWindow(): void {
  const target = resolveDesktopLoadTarget({
    ...process.env,
    DSH_DESKTOP_DEV_URL: process.env.DSH_DESKTOP_DEV_URL ?? (
      process.env.DSH_DESKTOP_DEV === '1' ? DEFAULT_DESKTOP_DEV_URL : undefined
    ),
  })
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  void mainWindow.loadURL(target.url)
}

async function retryHostBoot(): Promise<{ ok: boolean; error?: string }> {
  if (shouldSkipHostBoot()) return { ok: true }
  if (hostController.isBooted) return { ok: true }
  try {
    await hostController.boot()
    writeDevBootGraph()
    wireIpcApiBridge()
    mainWindow?.reload()
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}

app.whenReady().then(async () => {
  registerDshProtocol()
  await bootIntegratedHost()
  createMainWindow()
})

app.on('before-quit', () => {
  disposeIpcBridge?.()
  void hostController.teardown()
})

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.handle('dsh:host-boot-retry', () => retryHostBoot())

export { preloadFileUrl, repoRoot }
