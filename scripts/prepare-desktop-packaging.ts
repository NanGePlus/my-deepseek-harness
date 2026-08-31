/**
 * Stage web dist, Playwright Chromium, and Host runtime for electron-builder.
 * @module scripts/prepare-desktop-packaging
 */

import { spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_DIST = 'web-dist'
const PLAYWRIGHT_BROWSERS = 'playwright-browsers'
const HOST_RUNTIME = 'host-runtime'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const stagingRoot = join(root, 'dist/desktop/staging')
const appRoot = join(stagingRoot, 'app')
const extraRoot = join(stagingRoot, 'extra')
const DEPLOY_ROOT = 'dsh-desktop-host-pkg'

function pnpmBin(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? 'unknown'}`))
    })
  })
}

async function clearStaging(): Promise<void> {
  if (stagingRoot === root || root.startsWith(`${stagingRoot}/`)) {
    throw new Error(`prepare-desktop-packaging: refusing to clear staging dir ${stagingRoot}`)
  }
  await rm(stagingRoot, { recursive: true, force: true })
  await mkdir(appRoot, { recursive: true })
  await mkdir(extraRoot, { recursive: true })
}

async function buildArtifacts(): Promise<void> {
  await run(pnpmBin(), ['run', 'build'])
  await run(pnpmBin(), ['exec', 'tsc', '-b', 'apps/cli'])
  await run(pnpmBin(), ['--filter', '@deepseek-ai/dsh-desktop-shell', 'run', 'build'])
}

async function copyAppTree(): Promise<void> {
  await cp(join(root, 'apps/desktop/lib'), join(appRoot, 'apps/desktop/lib'), { recursive: true })
  await cp(join(root, 'apps/cli/lib'), join(appRoot, 'apps/cli/lib'), { recursive: true })
  await cp(join(root, 'apps/cli/config'), join(appRoot, 'apps/cli/config'), { recursive: true })
  await cp(join(root, 'apps/desktop/package.json'), join(appRoot, 'apps/desktop/package.json'))
  await cp(join(root, 'apps/cli/package.json'), join(appRoot, 'apps/cli/package.json'))
  const desktopPackage = JSON.parse(await readFile(join(root, 'apps/desktop/package.json'), 'utf8')) as { version: string }
  await writeFile(join(appRoot, 'package.json'), `${JSON.stringify({
    name: 'deepseek-harness-desktop',
    private: true,
    type: 'module',
    version: desktopPackage.version,
    main: 'apps/desktop/lib/main.js',
  }, null, 2)}\n`)
}

async function deployHostRuntime(destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true })
  await rm(destination, { recursive: true, force: true })
  await run(pnpmBin(), [
    '--filter',
    DEPLOY_ROOT,
    'deploy',
    '--legacy',
    '--prod',
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=false',
    '--config.link-workspace-packages=true',
    '--config.ignore-scripts=true',
    destination,
  ])
}

async function stageWebDist(): Promise<void> {
  const target = join(extraRoot, WEB_DIST)
  await rm(target, { recursive: true, force: true })
  await cp(join(root, 'apps/web/dist'), target, { recursive: true })
}

async function stagePlaywrightBrowsers(): Promise<void> {
  const target = join(extraRoot, PLAYWRIGHT_BROWSERS)
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  await run(pnpmBin(), ['exec', 'playwright', 'install', 'chromium'], {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: target,
  })
}

async function main(): Promise<void> {
  await clearStaging()
  await buildArtifacts()
  await copyAppTree()
  await deployHostRuntime(join(appRoot, 'node_modules-deploy'))
  await cp(join(appRoot, 'node_modules-deploy', 'node_modules'), join(appRoot, 'node_modules'), { recursive: true })
  await rm(join(appRoot, 'node_modules-deploy'), { recursive: true, force: true })
  const hostRuntime = join(extraRoot, HOST_RUNTIME)
  await rm(hostRuntime, { recursive: true, force: true })
  await mkdir(hostRuntime, { recursive: true })
  await cp(join(appRoot, 'node_modules'), join(hostRuntime, 'node_modules'), { recursive: true })
  await cp(join(appRoot, 'package.json'), join(hostRuntime, 'package.json'))
  await stageWebDist()
  await stagePlaywrightBrowsers()
}

await main()
