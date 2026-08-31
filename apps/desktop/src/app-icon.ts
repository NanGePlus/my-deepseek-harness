/**
 * Resolve the desktop App icon path for Dock / Taskbar branding.
 * @module @deepseek-ai/dsh-desktop-shell/app-icon
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolve the packaged App icon under the repository root.
 * @param repoRoot - harness repository root.
 * @returns existing icon path or undefined when no asset is present.
 */
export function resolveDesktopAppIconPath(repoRoot: string): string | undefined {
  const candidates = [
    join(repoRoot, 'apps/desktop/resources/icon.png'),
    join(repoRoot, 'apps/web/public/favicon.svg'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}
