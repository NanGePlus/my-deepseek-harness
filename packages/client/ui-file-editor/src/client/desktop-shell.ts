/**
 * Desktop shell preload bridge for standard-shell chrome (exit guard, settings focus).
 * @module @deepseek-ai/dsh-client-ui-file-editor/client/desktop-shell
 */

import type { DirtyGuard } from './dirty-guard.ts'

/** Narrow preload surface for standard-shell IPC. */
export interface DesktopShellPreload {
  onExitRequest?: (listener: () => void) => () => void
  sendExitGuardResult?: (result: { proceed: boolean }) => void
  onFocusSettings?: (listener: () => void) => () => void
}

function readDesktopShellPreload(): DesktopShellPreload | undefined {
  return (globalThis as { dsh?: DesktopShellPreload }).dsh
}

/**
 * Wire Renderer dirty-editor exit guard to Main quit requests.
 * @param dirtyGuard - shared editor guard instance.
 * @returns disposer removing the IPC listener.
 */
export function wireDesktopExitGuard(dirtyGuard: DirtyGuard): () => void {
  const bridge = readDesktopShellPreload()
  if (bridge?.onExitRequest === undefined || bridge.sendExitGuardResult === undefined) return () => {}
  return bridge.onExitRequest(() => {
    void dirtyGuard.waitForExitDecision().then((decision) => {
      bridge.sendExitGuardResult?.({ proceed: decision === 'proceed' })
    })
  })
}
