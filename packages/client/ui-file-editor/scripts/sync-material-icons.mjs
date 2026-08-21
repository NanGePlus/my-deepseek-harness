#!/usr/bin/env node
/** Copy Material Icon Theme SVGs into the web frontend public directory. */

import { cp, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')
const repoRoot = join(packageRoot, '../../..')
const dest = join(repoRoot, 'apps/web/public/material-icons')

const require = createRequire(join(packageRoot, 'package.json'))
const themeRoot = dirname(require.resolve('material-icon-theme/package.json'))
const source = join(themeRoot, 'icons')

await mkdir(dest, { recursive: true })
await cp(source, dest, { force: true, recursive: true })
