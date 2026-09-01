/**
 * Patch the bundled Electron.app Info.plist so macOS dev launches show the product
 * name in the menu bar and Cmd+Tab switcher. Runtime `app.setName()` cannot override
 * those titles; only CFBundleName at bundle launch time can.
 * @module @deepseek-ai/dsh-desktop-shell/brand-dev-electron
 */

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DESKTOP_APP_DISPLAY_NAME } from '../src/app-branding.ts'

const PLIST_BUDDY = '/usr/libexec/PlistBuddy'

function plistPathOfElectronBinary(electronBin: string): string {
  return resolve(dirname(electronBin), '../Info.plist')
}

function readPlistString(plistPath: string, key: string): string | undefined {
  try {
    const value = execFileSync(PLIST_BUDDY, ['-c', `Print :${key}`, plistPath], {
      encoding: 'utf8',
    }).trim()
    return value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}

function writePlistString(plistPath: string, key: string, value: string): void {
  execFileSync(PLIST_BUDDY, ['-c', `Set :${key} ${value}`, plistPath], { stdio: 'inherit' })
}

function patchDevElectronName(displayName: string): void {
  if (process.platform !== 'darwin') return
  try {
    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
    const electronBin = createRequire(resolve(repoRoot, 'apps/cli/package.json'))('electron') as string
    const plistPath = plistPathOfElectronBinary(electronBin)
    const currentName = readPlistString(plistPath, 'CFBundleName')
    const currentDisplay = readPlistString(plistPath, 'CFBundleDisplayName')
    if (currentName === displayName && currentDisplay === displayName) return

    const original = readFileSync(plistPath)
    unlinkSync(plistPath)
    writeFileSync(plistPath, original)
    writePlistString(plistPath, 'CFBundleName', displayName)
    writePlistString(plistPath, 'CFBundleDisplayName', displayName)
    console.log(`desktop dev: branded Electron.app as "${displayName}"`)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`desktop dev: could not brand Electron.app (${message}); menu bar may still show "Electron"`)
  }
}

patchDevElectronName(DESKTOP_APP_DISPLAY_NAME)
