/** One-time Monaco setup: LSP owns diagnostics and hover for every editable language. */

import type { MonacoEditorModule } from './monaco-load.ts'
import { ensureLspHoverProviders } from './monaco-hover.ts'

let configured = false

type ModeConfigurationDefaults = {
  modeConfiguration: Record<string, boolean>
  setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
}

/**
 * Turn off Monaco worker-backed hovers/diagnostics so host LSP owns the editor surface.
 * @param defaults - Monaco language defaults object.
 * @param flags - modeConfiguration keys to disable.
 */
function disableWorkerLanguageFeatures(
  defaults: ModeConfigurationDefaults | undefined,
  flags: Partial<Record<string, boolean>>,
): void {
  if (defaults === undefined) return
  defaults.setModeConfiguration({
    ...defaults.modeConfiguration,
    ...Object.fromEntries(Object.entries(flags).filter((entry): entry is [string, boolean] => entry[1] !== undefined)),
  })
}

/**
 * Disable Monaco's built-in validation/hover workers so marker hovers stay readable
 * and do not compete with the host LSP diagnostics and hover stream.
 * @param monaco - loaded monaco-editor module.
 */
export function ensureMonacoConfigured(monaco: MonacoEditorModule): void {
  if (configured) return
  configured = true

  const withoutBuiltInHover = { hovers: false, diagnostics: false }

  const ts = monaco.languages?.typescript
  ts?.typescriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  })
  ts?.javascriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  })
  disableWorkerLanguageFeatures(ts?.typescriptDefaults, withoutBuiltInHover)
  disableWorkerLanguageFeatures(ts?.javascriptDefaults, withoutBuiltInHover)

  const json = monaco.languages?.json?.jsonDefaults
  json?.setDiagnosticsOptions({ validate: false })
  disableWorkerLanguageFeatures(json, withoutBuiltInHover)

  const html = monaco.languages?.html?.htmlDefaults
  disableWorkerLanguageFeatures(html, withoutBuiltInHover)

  for (const cssDefaults of [
    monaco.languages?.css?.cssDefaults,
    monaco.languages?.css?.scssDefaults,
    monaco.languages?.css?.lessDefaults,
  ]) {
    cssDefaults?.setDiagnosticsOptions({ validate: false })
    disableWorkerLanguageFeatures(cssDefaults, withoutBuiltInHover)
  }

  ensureLspHoverProviders(monaco)
}
