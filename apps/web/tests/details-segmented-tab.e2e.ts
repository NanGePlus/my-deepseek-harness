// Keyless browser regression for the details segmented tab chrome and editor-surface
// (file tree + unopened-file empty state). The workspace fixture is not a Git
// repository: an empty `.git` directory would make `git status` mis-detect one.
// This slice covers the three-tab chrome (File editor | Git | Tool details)
// and the Git panel not-a-repository empty state of the non-Git workspace fixture.
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden, fixtureUserPrompts,
  launchWebScaffold, seedSession, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/details-segmented-tab', import.meta.url))
const TABS_EXPECTED = join(SNAPSHOT_DIR, 'tabs.expected.md')
const EDITOR_EXPECTED = join(SNAPSHOT_DIR, 'editor-empty.expected.md')
const GIT_EXPECTED = join(SNAPSHOT_DIR, 'git-empty.expected.md')
const FIXTURE = fileURLToPath(new URL('./snapshots/lifecycle-chrome/session.jsonl', import.meta.url))
const SEED_FIXTURE = fileURLToPath(new URL('./snapshots/seeded-history/seed.jsonl', import.meta.url))
const PROMPT = 'Reply with the single word LIGHTHOUSE and stop.'
const MODE = webSnapshotMode()

async function detailsTrack(page: Page): Promise<number> {
  return await page.locator('[style*="grid-template-columns"]').first().evaluate((element) => {
    const tracks = getComputedStyle(element).gridTemplateColumns.split(' ')
    return Number.parseFloat(tracks.at(-1) ?? 'NaN')
  })
}

async function openDetailsViaEditorTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'File editor' }).click({ force: true })
  await expect.poll(() => detailsTrack(page), { timeout: 10_000 }).toBeGreaterThan(0)
}

/** Seed a stable, non-Git workspace tree for the editor-surface snapshot. */
function seedEditorWorkspace(root: string): void {
  const ws = join(root, 'workspace')
  mkdirSync(join(ws, 'src'), { recursive: true })
  mkdirSync(join(ws, 'node_modules'), { recursive: true })
  writeFileSync(join(ws, 'README.md'), '# fixture\n')
  writeFileSync(join(ws, '.gitignore'), 'node_modules\n')
  writeFileSync(join(ws, 'src', 'index.ts'), 'export {}\n')
  writeFileSync(join(ws, 'node_modules', 'pkg.js'), 'module.exports = {}\n')
}

describe.skipIf(MODE === 'record')('web e2e: details segmented tab chrome', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    const fixture = await readFile(FIXTURE, 'utf8')
    expect(fixtureUserPrompts(fixture)).toEqual([PROMPT])
    scaffold = await launchWebScaffold({ replayFixture: FIXTURE, paceMs: 5 })
    await seedSession(scaffold, await readFile(SEED_FIXTURE, 'utf8'), 'details-segmented-tab-seed')
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.locator('[style*="grid-template-columns"]').first().waitFor({ timeout: 30_000 })
    seedEditorWorkspace(scaffold.workspaceCwd)
    await connectFreshWorkspace(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('shows segmented tab labels, the file tree, and the unopened-file empty state', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-details-segmented-tab'))
    const settled = scaffold.whenTurnSettled()
    const input = page.locator('textarea').first()
    await input.fill(PROMPT)
    await input.press('Enter')
    await settled
    await page.getByText('LIGHTHOUSE', { exact: true }).waitFor({ timeout: 15_000 })

    await openDetailsViaEditorTab(page)

    const tabsSnapshot = await captureStableAria(page, '[role="tablist"][aria-label="Toolbox"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(TABS_EXPECTED, tabsSnapshot, MODE)

    await page.getByRole('tab', { name: 'File editor' }).click()
    await page.getByText('No file open', { exact: true }).waitFor({ timeout: 5_000 })
    await page.getByRole('treeitem', { name: /README\.md/ }).waitFor({ timeout: 10_000 })
    await expect.poll(
      () => page.getByRole('progressbar', { name: 'Loading Git status' }).count(),
    ).toBe(0)

    const editorSnapshot = await captureStableAria(page, '[data-surface="editor-surface"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(EDITOR_EXPECTED, editorSnapshot, MODE)

    await page.getByRole('tab', { name: 'Git panel' }).click()
    expect(await page.getByRole('tab', { name: 'Git panel' }).getAttribute('aria-selected')).toBe('true')
    expect(await page.getByRole('tab', { name: 'File editor' }).getAttribute('aria-selected')).toBe('false')
    expect(await page.getByRole('tab', { name: 'Tool details' }).getAttribute('aria-selected')).toBe('false')
    await expect.poll(() => detailsTrack(page), { timeout: 10_000 }).toBeGreaterThan(0)
    await page.getByText('Not a Git repository', { exact: true }).waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Initialize repository' }).waitFor({ timeout: 5_000 })
    const gitSnapshot = await captureStableAria(page, '[data-surface="git-panel"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(GIT_EXPECTED, gitSnapshot, MODE)

    await page.getByRole('tab', { name: 'Tool details' }).click()
    await page.getByText('Click a tool row in the message flow to view its details', { exact: true }).waitFor({ timeout: 5_000 })

    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['tabs.expected.md', 'editor-empty.expected.md', 'git-empty.expected.md'])
  }, 90_000)
})
