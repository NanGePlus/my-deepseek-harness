/**
 * dsh:// protocol seam (production SPA dist loading).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  productionSpaUrl,
  readDshProtocolAsset,
  resolveDshProtocolPath,
} from '../src/protocol-dsh.ts'

describe('dsh:// protocol seam', () => {
  let distRoot = ''

  afterEach(() => {
    if (distRoot !== '') rmSync(distRoot, { recursive: true, force: true })
    distRoot = ''
  })

  it('maps dsh://app/index.html to dist and injects __DSH_BOOT__', () => {
    distRoot = mkdtempSync(join(tmpdir(), 'dsh-protocol-dist-'))
    writeFileSync(join(distRoot, 'index.html'), '<html><head></head><body></body></html>\n')
    const graph = {
      rev: 'abc',
      entries: [{ id: '@deepseek-ai/dsh-client-ui-theme', url: 'dsh://app/plugins/@deepseek-ai/dsh-client-ui-theme/client.js?rev=abc', rev: 'abc' }],
    }
    const resolved = resolveDshProtocolPath(distRoot, productionSpaUrl(), graph)
    expect(resolved).toBe(join(distRoot, 'index.html'))
    const { body, mimeType } = readDshProtocolAsset(resolved!, graph)
    expect(mimeType).toBe('text/html; charset=utf-8')
    expect(body).toContain('window.__DSH_BOOT__')
    expect(body).toContain('@deepseek-ai/dsh-client-ui-theme')
  })

  it('serves plugin bundles from the composed boot graph', () => {
    distRoot = mkdtempSync(join(tmpdir(), 'dsh-protocol-bundle-'))
    const bundleDir = join(distRoot, 'bundle')
    mkdirSync(bundleDir, { recursive: true })
    const bundlePath = join(bundleDir, 'client.js')
    writeFileSync(bundlePath, 'console.log("plugin")\n')
    const bundles = new Map([['@deepseek-ai/dsh-client-ui-theme', { id: '@deepseek-ai/dsh-client-ui-theme', clientPath: bundlePath }]])
    const resolved = resolveDshProtocolPath(
      distRoot,
      'dsh://app/plugins/@deepseek-ai/dsh-client-ui-theme/client.js?rev=abc',
      undefined,
      bundles,
    )
    expect(resolved).toBe(bundlePath)
    expect(readFileSync(resolved!, 'utf8')).toContain('plugin')
  })
})
