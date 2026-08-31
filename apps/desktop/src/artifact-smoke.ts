/**
 * Headless validation of electron-builder extraResources layout.
 * @module @deepseek-ai/dsh-desktop-shell/artifact-smoke
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DESKTOP_EXTRA_RESOURCE_NAMES } from './packaging-paths.ts'

const CHROME_EXECUTABLE_NAMES = new Set([
  'chrome',
  'chrome.exe',
  'Chromium',
  'Google Chrome for Testing',
])

/**
 * Validate that a packaged app's Resources directory contains SPA dist and Chromium.
 * @param resourcesRoot - Electron `Contents/Resources` (macOS) or `resources` (Windows).
 */
export function validatePackagedArtifactResources(resourcesRoot: string): void {
  const webIndex = join(resourcesRoot, DESKTOP_EXTRA_RESOURCE_NAMES.webDist, 'index.html')
  if (!existsSync(webIndex)) {
    throw new Error(`desktop artifact smoke: missing ${DESKTOP_EXTRA_RESOURCE_NAMES.webDist}/index.html under ${resourcesRoot}`)
  }
  const browsersRoot = join(resourcesRoot, DESKTOP_EXTRA_RESOURCE_NAMES.playwrightBrowsers)
  if (!existsSync(browsersRoot)) {
    throw new Error(`desktop artifact smoke: missing ${DESKTOP_EXTRA_RESOURCE_NAMES.playwrightBrowsers} under ${resourcesRoot}`)
  }
  if (findBundledChromiumExecutable(browsersRoot) === undefined) {
    throw new Error(`desktop artifact smoke: no Playwright Chromium bundle found under ${browsersRoot}`)
  }
}

/** Locate one Playwright `chromium-*` bundle executable for smoke validation. */
export function findBundledChromiumExecutable(browsersRoot: string): string | undefined {
  if (!existsSync(browsersRoot)) return undefined
  for (const entry of readdirSync(browsersRoot)) {
    if (!entry.startsWith('chromium-')) continue
    const found = findChromeBinary(join(browsersRoot, entry))
    if (found !== undefined) return found
  }
  return undefined
}

function findChromeBinary(root: string): string | undefined {
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) continue
    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      continue
    }
    for (const entry of entries) {
      const candidate = join(current, entry)
      if (CHROME_EXECUTABLE_NAMES.has(entry)) {
        try {
          const stat = statSync(candidate)
          if (stat.isFile()) return candidate
        } catch {
          continue
        }
      }
      try {
        if (statSync(candidate).isDirectory()) stack.push(candidate)
      } catch {
        continue
      }
    }
  }
  return undefined
}
