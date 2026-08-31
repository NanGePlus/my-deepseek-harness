/**
 * Invoke electron-builder from the desktop shell package without pnpm filter hooks.
 */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const desktopRoot = join(repoRoot, 'apps/desktop')
const require = createRequire(join(desktopRoot, 'package.json'))
const builderCli = require.resolve('electron-builder/cli.js')
const args = process.argv.slice(2)

const result = spawnSync(process.execPath, [builderCli, ...args], {
  cwd: desktopRoot,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
