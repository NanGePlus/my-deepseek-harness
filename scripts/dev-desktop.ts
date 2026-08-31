/**
 * Parallel Vite (desktop dev config) + Electron for `pnpm run dev:desktop`.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv): ReturnType<typeof spawn> {
  return spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
}

const vite = run(
  process.execPath,
  ['--import', 'tsx/esm', 'node_modules/vite/bin/vite.js', '--config', 'apps/web/vite.desktop-dev.config.ts'],
  { DSH_DESKTOP_DEV: '1' },
)

const electron = run(
  process.execPath,
  ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'desktop'],
  { DSH_DESKTOP_DEV: '1', DSH_DESKTOP_DEV_URL: 'http://127.0.0.1:5173/' },
)

let exiting = false
const shutdown = (code: number): void => {
  if (exiting) return
  exiting = true
  vite.kill('SIGTERM')
  electron.kill('SIGTERM')
  process.exit(code)
}

vite.on('close', (code) => { shutdown(code ?? 1) })
electron.on('close', (code) => { shutdown(code ?? 1) })
vite.on('error', () => { shutdown(1) })
electron.on('error', () => { shutdown(1) })

process.on('SIGINT', () => { shutdown(130) })
process.on('SIGTERM', () => { shutdown(0) })
