/**
 * Desktop Main Host boot + teardown seam (Issue #115 / PRD Electron Main Host boot).
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { DesktopHostController } from '../src/host-boot.ts'

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

describe('desktop Main Host boot seam', () => {
  const controllers: DesktopHostController[] = []
  let workspace = ''

  afterEach(async () => {
    for (const controller of controllers.splice(0)) await controller.teardown()
    if (workspace !== '') rmSync(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it('boots the desktop profile on ready and serves host.describe without webserver', async () => {
    workspace = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-desktop-main-boot-')))
    mkdirSync(join(workspace, 'sessions'), { recursive: true })
    mkdirSync(join(workspace, 'storages'), { recursive: true })
    const controller = new DesktopHostController()
    controllers.push(controller)
    const { ctx } = await controller.boot({ workspace })
    expect(controller.isBooted).toBe(true)
    expect(ctx.get('webServer')).toBeUndefined()
    expect(ctx.get('apiProxy')).toBeDefined()
    const description = expectOk(await ctx.apiProxy.host.describe({
      rpcId: RpcId('desktop-main-describe'),
      payload: {},
    }))
    expect(description.cwd).toBe(workspace)
  }, 120_000)

  it('teardown disposes the Host after quit', async () => {
    workspace = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-desktop-main-teardown-')))
    mkdirSync(join(workspace, 'sessions'), { recursive: true })
    mkdirSync(join(workspace, 'storages'), { recursive: true })
    const controller = new DesktopHostController()
    controllers.push(controller)
    const { ctx } = await controller.boot({ workspace })
    await controller.teardown()
    expect(controller.isBooted).toBe(false)
    expect(ctx.get('loader')).toBeUndefined()
  }, 120_000)
})
