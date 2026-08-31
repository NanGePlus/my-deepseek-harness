/**
 * Bundle Electron Main/preload to `lib/` for packaging.
 * @module @deepseek-ai/dsh-desktop-shell/bundle
 */

import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(desktopRoot, 'lib')

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

await esbuild.build({
  entryPoints: [
    join(desktopRoot, 'src/main.ts'),
    join(desktopRoot, 'src/preload.ts'),
  ],
  outdir: outDir,
  platform: 'node',
  format: 'esm',
  target: 'es2024',
  packages: 'external',
  bundle: false,
  sourcemap: true,
})

console.log(`bundled desktop shell to ${outDir}`)
