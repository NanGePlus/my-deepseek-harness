/**
 * Desktop app-shell integration seam (Issue #121 / PRD 功能对等 smoke seam).
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DETAILS_TAB_LABELS } from '../../../packages/client/ui-conversation/src/client/details-tab-labels.ts'
import { createExitGuardCoordinator } from '../src/exit-guard.ts'
import { DesktopHostController } from '../src/host-boot.ts'
import { installSingleInstanceLock } from '../src/single-instance.ts'
import { shouldSkipHostBoot } from '../src/attach.ts'
import { buildDesktopSpaIndexHtml } from '../src/spa-index.ts'

describe('desktop app-shell integration seam', () => {
  const controllers: DesktopHostController[] = []
  let workspace = ''
  let distRoot = ''

  afterEach(async () => {
    for (const controller of controllers.splice(0)) await controller.teardown()
    if (workspace !== '') rmSync(workspace, { recursive: true, force: true })
    if (distRoot !== '') rmSync(distRoot, { recursive: true, force: true })
    workspace = ''
    distRoot = ''
  })

  function makeDist(): string {
    distRoot = mkdtempSync(join(tmpdir(), 'dsh-desktop-spa-index-'))
    writeFileSync(join(distRoot, 'index.html'), '<html><head></head><body></body></html>')
    return distRoot
  }

  function makeWorkspace(): string {
    workspace = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-desktop-app-shell-')))
    mkdirSync(join(workspace, 'sessions'), { recursive: true })
    mkdirSync(join(workspace, 'storages'), { recursive: true })
    return workspace
  }

  it('default: integrated Host boot exposes the five-segment toolbox labels for parity smoke', async () => {
    makeWorkspace()
    const controller = new DesktopHostController()
    controllers.push(controller)
    await controller.boot({ workspace })
    expect(controller.isBooted).toBe(true)
    expect([...DETAILS_TAB_LABELS]).toEqual([
      '资源管理器',
      'Git面板',
      '终端',
      '浏览器',
      '工具详情',
    ])
  }, 120_000)

  it('single-instance: second launch focuses the window without a second Host boot', async () => {
    makeWorkspace()
    let hostBootCount = 0
    const controller = new DesktopHostController()
    controllers.push(controller)
    const bootOnce = async (): Promise<void> => {
      hostBootCount += 1
      await controller.boot({ workspace })
    }

    let secondInstance: (() => void) | undefined
    const focusMainWindow = vi.fn()
    const acquired = installSingleInstanceLock({
      requestSingleInstanceLock: () => true,
      onSecondInstance: (listener) => { secondInstance = listener },
      quit: () => {},
      focusMainWindow,
    })
    expect(acquired).toBe(true)
    await bootOnce()
    secondInstance?.()
    expect(focusMainWindow).toHaveBeenCalledOnce()
    expect(hostBootCount).toBe(1)
    expect(controller.isBooted).toBe(true)
  }, 120_000)

  it('quit: proceeds through exit guard and teardowns integrated Host', async () => {
    makeWorkspace()
    const controller = new DesktopHostController()
    controllers.push(controller)
    await controller.boot({ workspace })
    let teardownDone: Promise<void> | undefined
    const exitGuard = createExitGuardCoordinator({
      sendExitRequest: () => {},
      teardownHost: () => { teardownDone = controller.teardown() },
      isAttachMode: () => false,
    })
    const decision = exitGuard.requestQuit()
    exitGuard.handleExitGuardResult({ proceed: true })
    await expect(decision).resolves.toBe(true)
    await teardownDone
    expect(controller.isBooted).toBe(false)
  }, 120_000)

  it('exit-guard: dirty editor decision blocks Host teardown', async () => {
    makeWorkspace()
    const controller = new DesktopHostController()
    controllers.push(controller)
    await controller.boot({ workspace })
    const teardownHost = vi.fn(async () => { await controller.teardown() })
    const exitGuard = createExitGuardCoordinator({
      sendExitRequest: () => {},
      teardownHost,
      isAttachMode: () => false,
    })
    const decision = exitGuard.requestQuit()
    exitGuard.handleExitGuardResult({ proceed: false })
    await expect(decision).resolves.toBe(false)
    expect(teardownHost).not.toHaveBeenCalled()
    expect(controller.isBooted).toBe(true)
  }, 120_000)

  it('attach-host: skips integrated Host boot and exit teardown', async () => {
    expect(shouldSkipHostBoot({ DSH_DESKTOP_ATTACH: 'http://127.0.0.1:8787' })).toBe(true)
    const teardownHost = vi.fn()
    const exitGuard = createExitGuardCoordinator({
      sendExitRequest: () => {},
      teardownHost,
      isAttachMode: () => true,
    })
    const decision = exitGuard.requestQuit()
    exitGuard.handleExitGuardResult({ proceed: true })
    await expect(decision).resolves.toBe(true)
    expect(teardownHost).not.toHaveBeenCalled()
  })

  it('host-boot-error: injects loud error wire when integrated Host boot failed', () => {
    const root = makeDist()
    const html = buildDesktopSpaIndexHtml({
      distRoot: root,
      skipHostBoot: false,
      hostBooted: false,
      lastHostBootError: 'Host unavailable',
    })
    expect(html).toContain('window.__DSH_HOST_BOOT__')
    expect(html).toContain('"ok":false')
    expect(html).toContain('Host unavailable')
  })

  it('loading: success wire is injected when integrated Host boot succeeded', async () => {
    makeWorkspace()
    const root = makeDist()
    const controller = new DesktopHostController()
    controllers.push(controller)
    const { ctx } = await controller.boot({ workspace })
    const html = buildDesktopSpaIndexHtml({
      distRoot: root,
      skipHostBoot: false,
      hostBooted: true,
      hostContext: ctx,
    })
    expect(html).toContain('"ok":true')
    expect(html).toContain('window.__DSH_BOOT__')
  }, 120_000)
})
