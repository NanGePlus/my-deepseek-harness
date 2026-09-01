/**
 * Parallel Vite (desktop dev config) + Electron for `pnpm run dev:desktop`.
 */
import { accessSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const webAppRoot = join(repoRoot, 'apps/web')
const viteBin = join(webAppRoot, 'node_modules/vite/bin/vite.js')
accessSync(viteBin)

execSync('pnpm exec tsx apps/desktop/scripts/bundle-preload.ts', {
  cwd: repoRoot,
  stdio: 'inherit',
})
execSync('pnpm exec tsx apps/desktop/scripts/brand-dev-electron.ts', {
  cwd: repoRoot,
  stdio: 'inherit',
})

const electron = createRequire(join(repoRoot, 'apps/cli/package.json'))('electron') as string
const desktopMain = join(repoRoot, 'apps/desktop/src/main.ts')

function run(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  cwd = repoRoot,
): ReturnType<typeof spawn> {
  return spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
}

const vite = run(
  process.execPath,
  ['--import', 'tsx/esm', viteBin, '--config', 'vite.desktop-dev.config.ts'],
  { DSH_DESKTOP_DEV: '1' },
  webAppRoot,
)

const electronProc = spawn(electron, [desktopMain], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: '--import tsx/esm',
    DSH_DESKTOP_DEV: '1',
    DSH_DESKTOP_DEV_URL: 'http://127.0.0.1:5173/',
  },
  stdio: 'inherit',
})

let exiting = false
const shutdown = (code: number): void => {
  if (exiting) return
  exiting = true
  vite.kill('SIGTERM')
  electronProc.kill('SIGTERM')
  process.exit(code)
}

vite.on('close', (code) => { shutdown(code ?? 1) })
electronProc.on('close', (code) => { shutdown(code ?? 1) })
vite.on('error', () => { shutdown(1) })
electronProc.on('error', () => { shutdown(1) })

process.on('SIGINT', () => { shutdown(130) })
process.on('SIGTERM', () => { shutdown(0) })
