/**
 * Spawn the desktop Electron shell from `dsh desktop`.
 * @module @deepseek-ai/dsh/desktop-launcher
 */

import { accessSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

/**
 * Resolve the Electron executable path from the workspace install.
 * @returns absolute path to the electron binary.
 */
export function resolveElectronExecutable(): string {
  const require = createRequire(join(cliRoot, 'package.json'))
  return require('electron') as string
}

/**
 * Resolve the desktop Main entry (built lib preferred, tsx source fallback).
 * @returns absolute path to main.js or main.ts.
 */
export function resolveDesktopMainEntry(): string {
  const built = join(repoRoot, 'apps/desktop/lib/main.js')
  try {
    accessSync(built)
    return built
  } catch {
    return join(repoRoot, 'apps/desktop/src/main.ts')
  }
}

/**
 * Launch the desktop shell process.
 * @param args - forwarded inner arguments (reserved for future flags).
 * @returns child exit code promise.
 */
export async function spawnDesktop(args: readonly string[]): Promise<number> {
  const electron = resolveElectronExecutable()
  const mainEntry = resolveDesktopMainEntry()
  const useTsx = mainEntry.endsWith('.ts')
  const command = useTsx ? process.execPath : electron
  const commandArgs = useTsx
    ? ['--import', 'tsx/esm', mainEntry, ...args]
    : [mainEntry, ...args]
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: repoRoot,
      env: {
        ...process.env,
        DSH_DESKTOP_DEV: process.env.DSH_DESKTOP_DEV,
        DSH_DESKTOP_DEV_URL: process.env.DSH_DESKTOP_DEV_URL,
        DSH_DESKTOP_ATTACH: process.env.DSH_DESKTOP_ATTACH,
      },
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => { resolve(code ?? 1) })
  })
}
