/**
 * Electron sandbox preload esbuild options: classic script, not ESM.
 * @module @deepseek-ai/dsh-desktop-shell/preload-bundle
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BuildOptions } from 'esbuild'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * Bundle sandboxed preload to CommonJS.
 * @param outfile - absolute path of the emitted `preload.js`.
 * @returns esbuild options; `electron` stays external.
 */
export function preloadBundleOptions(outfile: string): BuildOptions {
  return {
    entryPoints: [join(desktopRoot, 'src/preload.ts')],
    outfile,
    platform: 'node',
    format: 'cjs',
    target: 'es2024',
    bundle: true,
    external: ['electron'],
    sourcemap: true,
  }
}
