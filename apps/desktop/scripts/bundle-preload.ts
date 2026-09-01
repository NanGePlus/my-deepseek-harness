/**
 * Bundle sandbox preload only (fast path for `pnpm run dev:desktop`).
 * @module @deepseek-ai/dsh-desktop-shell/bundle-preload
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { preloadBundleOptions } from './preload-bundle.ts'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(desktopRoot, 'lib')
mkdirSync(outDir, { recursive: true })
await esbuild.build(preloadBundleOptions(join(outDir, 'preload.js')))
console.log(`bundled desktop preload to ${outDir}/preload.js`)
