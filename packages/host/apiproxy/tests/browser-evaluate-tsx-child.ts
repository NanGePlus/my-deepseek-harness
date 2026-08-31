/**
 * Source-launch probe: `node --import tsx/esm` must be able to browserScroll
 * without Playwright serializing tsx's `__name` helper into the page.
 */
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserRegistry } from '../src/browser-registry.ts'
import type { WorkspaceId } from '../src/api/workspace.ts'

const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-eval-tsx-')))
const fixturePath = join(root, 'page.html')
writeFileSync(
  fixturePath,
  '<!doctype html><html><body style="margin:0"><div style="width:180px;height:120px;overflow:auto"><div style="height:400px"></div></div></body></html>',
)
const registry = new BrowserRegistry(root, { headless: true })
const workspaceId = 'ws-eval-tsx' as WorkspaceId
const created = await registry.createTab(workspaceId)
await registry.navigate(workspaceId, created.tabId, `file://${fixturePath}`)
await registry.resizeViewport(workspaceId, created.tabId, 240, 180)
await registry.scroll(workspaceId, created.tabId, 0, 80, 90, 60)
await registry.sendPointer(workspaceId, created.tabId, { type: 'mouseMoved', x: 90, y: 60 })
await registry.closeTab(workspaceId, created.tabId)
console.log('evaluate-ok')
process.exit(0)
