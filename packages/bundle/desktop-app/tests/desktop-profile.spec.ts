/**
 * Desktop profile bundle: dump-config composition and Node-side boot seam.
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  boot,
  composeEntries,
  healProfilesModuleFallback,
  loadOverlayPatches,
  loadProfile,
  PROFILE_TEMPLATES,
} from '@deepseek-ai/dsh-app-boot'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import type { RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const BASE_PATCH_PATH = join(REPO_ROOT, 'packages/bundle/base/cordis.patch.yml')
const DESKTOP_PATCH_PATH = join(REPO_ROOT, 'packages/bundle/desktop-app/cordis.patch.yml')
const INSTALL_ANCHOR = join(REPO_ROOT, 'apps/cli/package.json')
const SHIPPED_PRESET_DIR = join(REPO_ROOT, 'apps/cli/config/agent-presets')

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

describe('desktop profile composition', () => {
  it('registers the desktop shipped profile template over dsh-base', () => {
    expect(PROFILE_TEMPLATES.desktop).toEqual([
      '@deepseek-ai/dsh-base',
      '@deepseek-ai/dsh-desktop-app',
    ])
  })

  it('composes apiproxy, terminal, git, and browser roster rows without webserver transport', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-desktop-compose-'))
    try {
      healProfilesModuleFallback(INSTALL_ANCHOR, home)
      const profile = loadProfile('dsh', 'desktop', INSTALL_ANCHOR, home, { userLayer: false })
      const rows = composeEntries(profile.layers.map(layer => layer.patches))
      const names = rows.map(row => row.name)
      expect(names).toContain('@deepseek-ai/dsh-host-apiproxy')
      expect(names).toContain('@deepseek-ai/dsh-client-ui-terminal')
      expect(names).toContain('@deepseek-ai/dsh-client-ui-git')
      expect(names).toContain('@deepseek-ai/dsh-client-ui-browser')
      expect(names).not.toContain('@deepseek-ai/dsh-host-webserver')
      expect(names).not.toContain('@deepseek-ai/dsh-web-app')
      expect(names).not.toContain('@deepseek-ai/dsh-client-connection')
      expect(names).not.toContain('@deepseek-ai/dsh-client-modules')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})

describe('desktop profile boot seam', () => {
  const disposers: Array<() => Promise<void>> = []
  let workspace = ''
  let harnessHome = ''

  afterEach(async () => {
    for (const dispose of disposers.splice(0)) await dispose()
    if (workspace !== '') rmSync(workspace, { recursive: true, force: true })
    workspace = ''
    harnessHome = ''
  })

  async function bootDesktopProfile(): Promise<import('@deepseek-ai/cordis').Context> {
    workspace = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-desktop-boot-')))
    harnessHome = join(workspace, '.dsh-home')
    healProfilesModuleFallback(INSTALL_ANCHOR, harnessHome)
    const profileDir = join(harnessHome, 'profiles', 'desktop-boot')
    mkdirSync(profileDir, { recursive: true })
    const rootConfig = join(profileDir, 'cordis.yml')
    writeFileSync(rootConfig, '[]\n')

    const patches: PatchOptions[] = [
      ...loadOverlayPatches('desktop boot', BASE_PATCH_PATH),
      ...loadOverlayPatches('desktop boot', DESKTOP_PATCH_PATH),
      {
        id: 'agent-presets',
        config: {
          default: 'standard',
          roots: [{ path: SHIPPED_PRESET_DIR, trust: 'system' }],
          includeUserRoot: false,
        },
      },
      { id: 'session-persistence-jsonl', config: { root: join(workspace, 'sessions') } },
      { id: 'storage-json', config: { root: join(workspace, 'storages') } },
      { id: 'settings', config: { dshHome: harnessHome } },
      { id: 'credentials', config: { dshHome: harnessHome } },
      { id: 'session-telemetry-otel', disabled: true },
      { id: 'session-title-llm', disabled: true },
      { id: 'agent-instructions', disabled: true },
      { id: 'llm-deepseek', disabled: true },
    ]

    const originalCwd = process.cwd()
    process.chdir(workspace)
    try {
      const ctx = await boot('desktop boot', rootConfig, patches)
      disposers.push(async () => { await ctx.fiber.dispose() })
      return ctx
    } finally {
      process.chdir(originalCwd)
    }
  }

  it('boots on Node and serves host.describe without a webserver row', async () => {
    const ctx = await bootDesktopProfile()
    expect(ctx.get('webServer')).toBeUndefined()
    expect(ctx.get('apiProxy')).toBeDefined()
    const description = expectOk(await ctx.apiProxy.host.describe({
      rpcId: RpcId('desktop-boot-describe'),
      payload: {},
    }))
    expect(description.cwd).toBe(workspace)
  }, 120_000)

  it('does not mount webserver after boot', async () => {
    const ctx = await bootDesktopProfile()
    expect(ctx.get('webServer')).toBeUndefined()
    expect([...ctx.loader.entries()].some(entry => entry.options.id === 'webserver')).toBe(false)
  }, 120_000)
})
