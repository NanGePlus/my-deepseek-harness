/**
 * Packaged vs development resource paths for the desktop shell.
 * @module @deepseek-ai/dsh-desktop-shell/packaging-paths
 */

import { join } from 'node:path'
import { resolveWebDistRoot } from './protocol-dsh.ts'

/** extraResources directory names written by {@link scripts/prepare-desktop-packaging.ts}. */
export const DESKTOP_EXTRA_RESOURCE_NAMES = {
  webDist: 'web-dist',
  playwrightBrowsers: 'playwright-browsers',
  hostRuntime: 'host-runtime',
} as const

/** Resolved on-disk locations for SPA dist and bundled Playwright browsers. */
export interface PackagingLayout {
  /** Built SPA dist root (`apps/web/dist` in dev, extraResources in production). */
  webDistRoot: string
  /** Playwright browser cache root when packaged; undefined in development. */
  playwrightBrowsersPath: string | undefined
  /** Deployed Host closure root when packaged; undefined in development. */
  hostRuntimeRoot: string | undefined
}

/** Inputs for {@link resolvePackagingLayout}. */
export interface PackagingLayoutOptions {
  /** Whether Electron reports a packaged build. */
  packaged: boolean
  /** Harness repository root (development) or app path anchor (production). */
  repoRoot: string
  /** Electron `process.resourcesPath` when packaged. */
  resourcesPath?: string
}

/**
 * Resolve SPA dist and bundled resource directories for the active delivery mode.
 * @param options - packaged flag and path anchors.
 * @returns layout used by protocol loading and runtime env wiring.
 */
export function resolvePackagingLayout(options: PackagingLayoutOptions): PackagingLayout {
  if (!options.packaged) {
    return {
      webDistRoot: resolveWebDistRoot(options.repoRoot),
      playwrightBrowsersPath: undefined,
      hostRuntimeRoot: undefined,
    }
  }
  const resourcesPath = options.resourcesPath ?? options.repoRoot
  return {
    webDistRoot: join(resourcesPath, DESKTOP_EXTRA_RESOURCE_NAMES.webDist),
    playwrightBrowsersPath: join(resourcesPath, DESKTOP_EXTRA_RESOURCE_NAMES.playwrightBrowsers),
    hostRuntimeRoot: join(resourcesPath, DESKTOP_EXTRA_RESOURCE_NAMES.hostRuntime),
  }
}
