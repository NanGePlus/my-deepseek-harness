/**
 * Environment wiring for packaged desktop builds (Playwright Chromium bundle).
 * @module @deepseek-ai/dsh-desktop-shell/packaging-env
 */

import type { PackagingLayout } from './packaging-paths.ts'

/**
 * Apply packaged runtime environment variables before Host boot.
 * @param layout - resolved resource locations for a packaged build.
 */
export function applyPackagedRuntimeEnv(layout: PackagingLayout): void {
  if (layout.playwrightBrowsersPath !== undefined) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = layout.playwrightBrowsersPath
  }
}

/** Read the Playwright-related env vars owned by packaged desktop delivery. */
export function packagedRuntimeEnvSnapshot(): Pick<NodeJS.ProcessEnv, 'PLAYWRIGHT_BROWSERS_PATH'> {
  return {
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
  }
}
