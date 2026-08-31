/**
 * Desktop packaging artifact smoke (Issue #120 / PRD 打包 artifact smoke).
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { validatePackagedArtifactResources } from '../src/artifact-smoke.ts'
import { applyPackagedRuntimeEnv, packagedRuntimeEnvSnapshot } from '../src/packaging-env.ts'
import {
  DESKTOP_EXTRA_RESOURCE_NAMES,
  resolvePackagingLayout,
} from '../src/packaging-paths.ts'

describe('packaged artifact resource smoke', () => {
  let staging = ''

  afterEach(() => {
    if (staging !== '') rmSync(staging, { recursive: true, force: true })
    staging = ''
  })

  it('validates web dist and bundled Playwright Chromium under extraResources', () => {
    staging = mkdtempSync(join(tmpdir(), 'dsh-desktop-artifact-smoke-'))
    const resourcesRoot = join(staging, 'resources')
    mkdirSync(join(resourcesRoot, DESKTOP_EXTRA_RESOURCE_NAMES.webDist), { recursive: true })
    writeFileSync(join(resourcesRoot, DESKTOP_EXTRA_RESOURCE_NAMES.webDist, 'index.html'), '<html></html>\n')
    seedFakeChromiumBundle(join(resourcesRoot, DESKTOP_EXTRA_RESOURCE_NAMES.playwrightBrowsers))
    expect(() => validatePackagedArtifactResources(resourcesRoot)).not.toThrow()
  })

  it('rejects artifacts missing apps/web dist', () => {
    staging = mkdtempSync(join(tmpdir(), 'dsh-desktop-artifact-missing-dist-'))
    const resourcesRoot = join(staging, 'resources')
    mkdirSync(join(resourcesRoot, DESKTOP_EXTRA_RESOURCE_NAMES.playwrightBrowsers, 'chromium-1200', 'chrome-linux'), { recursive: true })
    writeFileSync(join(resourcesRoot, DESKTOP_EXTRA_RESOURCE_NAMES.playwrightBrowsers, 'chromium-1200', 'chrome-linux', 'chrome'), '')
    expect(() => validatePackagedArtifactResources(resourcesRoot)).toThrow(/web-dist/)
  })
})

function playwrightChromiumRevision(): string {
  const require = createRequire(import.meta.url)
  const playwrightCoreRoot = require.resolve('playwright-core/package.json')
  const browsersJson = JSON.parse(readFileSync(join(playwrightCoreRoot, '..', 'browsers.json'), 'utf8')) as {
    browsers: Array<{ name: string; revision: string }>
  }
  const revision = browsersJson.browsers.find(entry => entry.name === 'chromium')?.revision
  if (revision === undefined) throw new Error('playwright-core browsers.json missing chromium revision')
  return revision
}

function seedFakeChromiumBundle(browsersRoot: string): void {
  const revision = playwrightChromiumRevision()
  const chromiumDir = join(browsersRoot, `chromium-${revision}`)
  if (process.platform === 'darwin') {
    const chrome = join(
      chromiumDir,
      `chrome-mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}`,
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    )
    mkdirSync(join(chrome, '..'), { recursive: true })
    writeFileSync(chrome, '')
    chmodSync(chrome, 0o755)
    return
  }
  if (process.platform === 'win32') {
    const chrome = join(chromiumDir, 'chrome-win64', 'chrome.exe')
    mkdirSync(join(chrome, '..'), { recursive: true })
    writeFileSync(chrome, '')
    return
  }
  const chrome = join(chromiumDir, 'chrome-linux', 'chrome')
  mkdirSync(join(chrome, '..'), { recursive: true })
  writeFileSync(chrome, '')
  chmodSync(chrome, 0o755)
}

describe('packaged Playwright runtime env', () => {
  let staging = ''

  afterEach(() => {
    if (staging !== '') rmSync(staging, { recursive: true, force: true })
    staging = ''
    delete process.env.PLAYWRIGHT_BROWSERS_PATH
  })

  it('sets PLAYWRIGHT_BROWSERS_PATH so chromium.executablePath resolves without install', async () => {
    staging = mkdtempSync(join(tmpdir(), 'dsh-desktop-chromium-env-'))
    const browsersRoot = join(staging, 'playwright-browsers')
    seedFakeChromiumBundle(browsersRoot)
    const layout = resolvePackagingLayout({
      packaged: true,
      resourcesPath: staging,
      repoRoot: staging,
    })
    applyPackagedRuntimeEnv(layout)
    expect(packagedRuntimeEnvSnapshot().PLAYWRIGHT_BROWSERS_PATH).toBe(browsersRoot)
    const { chromium: freshChromium } = await import('playwright')
    const executablePath = freshChromium.executablePath()
    expect(executablePath.startsWith(browsersRoot)).toBe(true)
    expect(existsSync(executablePath)).toBe(true)
  })
})

describe('packaging layout resolution', () => {
  it('keeps repository-relative dist during development', () => {
    const repoRoot = join(tmpdir(), 'repo')
    const layout = resolvePackagingLayout({ packaged: false, repoRoot })
    expect(layout.webDistRoot).toBe(join(repoRoot, 'apps/web/dist'))
    expect(layout.playwrightBrowsersPath).toBeUndefined()
  })

  it('maps production extraResources beside process.resourcesPath', () => {
    const resourcesPath = join(tmpdir(), 'DeepSeek Harness.app', 'Contents', 'Resources')
    const layout = resolvePackagingLayout({
      packaged: true,
      resourcesPath,
      repoRoot: join(resourcesPath, 'app.asar'),
    })
    expect(layout.webDistRoot).toBe(join(resourcesPath, DESKTOP_EXTRA_RESOURCE_NAMES.webDist))
    expect(layout.playwrightBrowsersPath).toBe(join(resourcesPath, DESKTOP_EXTRA_RESOURCE_NAMES.playwrightBrowsers))
  })
})
