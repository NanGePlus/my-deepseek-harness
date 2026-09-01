/**
 * Bundle Electron Main/preload to `lib/` for packaging.
 * @module @deepseek-ai/dsh-desktop-shell/bundle
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { globSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { preloadBundleOptions } from './preload-bundle.ts'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(desktopRoot, 'lib')
const preloadSrc = join(desktopRoot, 'src/preload.ts')

/** Rewrite relative `.ts` import specifiers to `.js` in emitted ESM. */
function rewriteRelativeTsImports(source: string): string {
  return source.replace(
    /from (['"])(\.\/?[^'"]+)\.ts\1/g,
    'from $1$2.js$1',
  )
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const mainEntries = globSync('src/**/*.ts', { cwd: desktopRoot })
  .sort()
  .map(rel => join(desktopRoot, rel))
  .filter(abs => abs !== preloadSrc)

await esbuild.build({
  entryPoints: mainEntries,
  outdir: outDir,
  platform: 'node',
  format: 'esm',
  target: 'es2024',
  packages: 'external',
  bundle: false,
  sourcemap: true,
})

await esbuild.build(preloadBundleOptions(join(outDir, 'preload.js')))

for (const rel of globSync('lib/**/*.js', { cwd: desktopRoot })) {
  if (rel.endsWith('lib/preload.js') || rel.endsWith('lib\\preload.js')) continue
  const abs = join(desktopRoot, rel)
  const content = await readFile(abs, 'utf8')
  await writeFile(abs, rewriteRelativeTsImports(content))
}

console.log(`bundled desktop shell to ${outDir}`)
