/**
 * Headless smoke for electron-builder desktop artifacts (Issue #120).
 */

import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const installersRoot = join(root, 'dist/desktop/installers')
const HOST_RUNTIME = 'host-runtime'

/** Resolve the unpacked app's Resources directory for CI smoke. */
export function resolveUnpackedResourcesRoot(outputDir = installersRoot): string {
  const candidates: string[] = []
  const pushAppResources = (appPath: string): void => {
    if (process.platform === 'darwin') {
      candidates.push(join(appPath, 'Contents', 'Resources'))
    } else if (process.platform === 'win32') {
      candidates.push(join(appPath, 'resources'))
    }
  }
  if (!existsSync(outputDir)) {
    throw new Error(`smoke-desktop-packaging: installers output missing at ${outputDir}`)
  }
  if (process.platform === 'darwin') {
    for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.endsWith('.app')) {
        pushAppResources(join(outputDir, entry.name))
      }
      if (!entry.isDirectory()) continue
      const nested = join(outputDir, entry.name)
      try {
        for (const child of readdirSync(nested, { withFileTypes: true })) {
          if (child.isDirectory() && child.name.endsWith('.app')) {
            pushAppResources(join(nested, child.name))
          }
        }
      } catch {
        continue
      }
    }
  }
  if (process.platform === 'win32') {
    candidates.push(join(outputDir, 'win-unpacked', 'resources'))
    for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name === 'win-unpacked') {
        candidates.push(join(outputDir, entry.name, 'resources'))
      }
    }
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`smoke-desktop-packaging: no unpacked desktop resources found under ${outputDir}`)
}

function validateHostRuntime(resourcesRoot: string): void {
  const hostRoot = join(resourcesRoot, HOST_RUNTIME)
  if (!existsSync(join(hostRoot, 'package.json'))) {
    throw new Error(`desktop artifact smoke: missing ${HOST_RUNTIME}/package.json`)
  }
  if (!existsSync(join(hostRoot, 'node_modules'))) {
    throw new Error(`desktop artifact smoke: missing ${HOST_RUNTIME}/node_modules`)
  }
}

const resourcesRoot = resolveUnpackedResourcesRoot()
const { validatePackagedArtifactResources } = await import(
  pathToFileURL(join(root, 'apps/desktop/lib/artifact-smoke.js')).href,
)
validatePackagedArtifactResources(resourcesRoot)
validateHostRuntime(resourcesRoot)
console.log(`desktop packaging smoke passed for ${resourcesRoot}`)
