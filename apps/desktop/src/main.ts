/**
 * Electron Main: Host boot, dsh:// protocol, BrowserWindow lifecycle.
 * @module @deepseek-ai/dsh-desktop-shell/main
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  screen,
} from 'electron'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy/api'
import { setDesktopBrowserSurface } from '@deepseek-ai/dsh-host-apiproxy'
import { resolveDesktopAppIconPath } from './app-icon.ts'
import { buildApplicationMenuTemplate } from './app-menu.ts'
import { registerBrowserBoundsIpc } from './browser-bounds-ipc.ts'
import { DesktopBrowserViewManager } from './browser-view-manager.ts'
import { composeDesktopBootGraph } from './boot-graph.ts'
import { createExitGuardCoordinator } from './exit-guard.ts'
import { DesktopHostController } from './host-boot.ts'
import { registerIpcApiBridge } from './ipc-api-bridge.ts'
import { hostBootFailureWire, hostBootSuccessWire, injectHostBootWire } from './host-boot-wire.ts'
import { resolveDesktopLoadTarget, DEFAULT_DESKTOP_DEV_URL } from './load-url.ts'
import { shouldSkipHostBoot } from './attach.ts'
import {
  IPC_EXIT_GUARD_RESULT,
  IPC_EXIT_REQUEST,
  IPC_FOCUS_SETTINGS,
} from './ipc-contract.ts'
import {
  DSH_APP_AUTHORITY,
  DSH_PROTOCOL_SCHEME,
  preloadFileUrl,
  readDshProtocolAsset,
  resolveDshProtocolPath,
} from './protocol-dsh.ts'
import { installSingleInstanceLock } from './single-instance.ts'
import { injectBootManifest } from '@deepseek-ai/dsh-client-modules'
import { loadWindowBounds, saveWindowBounds } from './window-bounds.ts'
import { applyPackagedRuntimeEnv } from './packaging-env.ts'
import { resolvePackagingLayout } from './packaging-paths.ts'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const packagingLayout = resolvePackagingLayout({
  packaged: app.isPackaged,
  repoRoot,
  resourcesPath: process.resourcesPath,
})

if (app.isPackaged) {
  applyPackagedRuntimeEnv(packagingLayout)
}
const bootGraphFile = join(repoRoot, '.sessions/desktop-boot-graph.json')
const DESKTOP_CDP_PORT = Number(process.env.DSH_DESKTOP_CDP_PORT ?? 9222)

if (!shouldSkipHostBoot()) {
  app.commandLine.appendSwitch('remote-debugging-port', String(DESKTOP_CDP_PORT))
}

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
let disposeBrowserBoundsIpc: (() => void) | undefined
let browserViewManager: DesktopBrowserViewManager | undefined
let quitting = false
const exitGuard = createExitGuardCoordinator({
  sendExitRequest: () => { mainWindow?.webContents.send(IPC_EXIT_REQUEST) },
  teardownHost: () => {
    disposeIpcBridge?.()
    disposeBrowserBoundsIpc?.()
    browserViewManager?.destroy()
    browserViewManager = undefined
    void hostController.teardown()
  },
  isAttachMode: () => shouldSkipHostBoot(),
})

function distRoot(): string {
  return packagingLayout.webDistRoot
}

function primaryWorkArea(): { x: number; y: number; width: number; height: number } {
  const area = screen.getPrimaryDisplay().workArea
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

function applyAppIcon(): void {
  const iconPath = resolveDesktopAppIconPath(repoRoot)
  if (iconPath === undefined) return
  const image = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin' && !image.isEmpty()) app.dock?.setIcon(image)
}

function writeDevBootGraph(): void {
  const ctx = hostController.context
  if (ctx === undefined) return
  mkdirSync(dirname(bootGraphFile), { recursive: true })
  bootGraph = composeDesktopBootGraph(ctx, 'http://127.0.0.1:5173')
  writeFileSync(bootGraphFile, `${JSON.stringify(bootGraph.graph, null, 2)}\n`)
}

function ensureBrowserViewManager(): DesktopBrowserViewManager {
  browserViewManager ??= new DesktopBrowserViewManager(() => mainWindow, DESKTOP_CDP_PORT)
  return browserViewManager
}

function wireDesktopBrowserSurface(): void {
  if (shouldSkipHostBoot()) return
  const manager = ensureBrowserViewManager()
  setDesktopBrowserSurface(manager)
  disposeBrowserBoundsIpc?.()
  disposeBrowserBoundsIpc = registerBrowserBoundsIpc(manager)
}

async function bootIntegratedHost(): Promise<void> {
  if (shouldSkipHostBoot()) return
  wireDesktopBrowserSurface()
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

function focusMainWindow(): void {
  if (mainWindow === undefined) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

async function beginQuit(): Promise<void> {
  if (quitting) return
  const proceed = await exitGuard.requestQuit()
  if (!proceed) return
  quitting = true
  if (mainWindow !== undefined) {
    const bounds = mainWindow.getBounds()
    saveWindowBounds(app.getPath('userData'), bounds)
  }
  app.quit()
}

function installApplicationMenu(): void {
  const appName = app.getName()
  const template = buildApplicationMenuTemplate({
    appName,
    version: app.getVersion(),
    showAbout: () => {
      void dialog.showMessageBox(mainWindow ?? undefined, {
        type: 'info',
        title: `About ${appName}`,
        message: appName,
        detail: `Version ${app.getVersion()}\nDeepSeek Harness desktop shell.`,
      })
    },
    focusSettings: () => { mainWindow?.webContents.send(IPC_FOCUS_SETTINGS) },
    requestQuit: () => { void beginQuit() },
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createMainWindow(): void {
  const target = resolveDesktopLoadTarget({
    ...process.env,
    DSH_DESKTOP_DEV_URL: process.env.DSH_DESKTOP_DEV_URL ?? (
      process.env.DSH_DESKTOP_DEV === '1' ? DEFAULT_DESKTOP_DEV_URL : undefined
    ),
  })
  const bounds = loadWindowBounds(app.getPath('userData'), primaryWorkArea())
  const iconPath = resolveDesktopAppIconPath(repoRoot)
  mainWindow = new BrowserWindow({
    ...bounds,
    icon: iconPath,
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    void beginQuit()
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

if (!installSingleInstanceLock({
  requestSingleInstanceLock: () => app.requestSingleInstanceLock(),
  onSecondInstance: (listener) => { app.on('second-instance', listener) },
  quit: () => { app.quit() },
  focusMainWindow,
}, { skip: shouldSkipHostBoot() })) {
  // Second instance: focus only; this process exits before Host boot.
} else {
  app.whenReady().then(async () => {
    applyAppIcon()
    registerDshProtocol()
    installApplicationMenu()
    await bootIntegratedHost()
    createMainWindow()
  })

  app.on('window-all-closed', () => { void beginQuit() })

  app.on('activate', () => {
    if (mainWindow === undefined) createMainWindow()
    else focusMainWindow()
  })
}

ipcMain.handle('dsh:host-boot-retry', () => retryHostBoot())
ipcMain.on(IPC_EXIT_GUARD_RESULT, (_event, result: { proceed?: boolean }) => {
  exitGuard.handleExitGuardResult({ proceed: result.proceed === true })
})

export { preloadFileUrl, repoRoot }
