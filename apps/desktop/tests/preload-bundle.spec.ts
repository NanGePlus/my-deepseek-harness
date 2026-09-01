/**
 * Sandboxed preload must be CommonJS: Electron sandbox cannot `import`.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { afterEach, describe, expect, it } from 'vitest'
import { preloadBundleOptions } from '../scripts/preload-bundle.ts'

describe('sandboxed preload bundle', () => {
  let dir = ''

  afterEach(() => {
    if (dir !== '') rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  it('emits CommonJS without ESM import statements', async () => {
    dir = mkdtempSync(join(tmpdir(), 'dsh-preload-'))
    const outfile = join(dir, 'preload.js')
    await build(preloadBundleOptions(outfile))
    const source = readFileSync(outfile, 'utf8')
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).toMatch(/require\(["']electron["']\)/)
  })
})
