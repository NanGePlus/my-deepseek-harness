/**
 * Single-instance lock and second-instance window focus.
 * @module @deepseek-ai/dsh-desktop-shell/single-instance
 */

/** Injectable Electron `app` surface for tests. */
export interface SingleInstanceDeps {
  /** Platform single-instance lock; false when another instance owns it. */
  requestSingleInstanceLock(): boolean
  /** Register a listener for subsequent launches. */
  onSecondInstance(listener: () => void): void
  /** Terminate this process (used when lock is not acquired). */
  quit(): void
  /** Bring the existing main window to the foreground. */
  focusMainWindow?: () => void
}

/** Options for {@link installSingleInstanceLock}. */
export interface SingleInstanceOptions {
  /** Skip lock acquisition (attach / developer mode). */
  skip?: boolean
}

/**
 * Acquire the single-instance lock or exit; wire second-instance focus.
 * @param deps - Electron app hooks.
 * @param options - attach-mode skip.
 * @returns true when this process should continue booting Host + GUI.
 */
export function installSingleInstanceLock(
  deps: SingleInstanceDeps,
  options: SingleInstanceOptions = {},
): boolean {
  if (options.skip === true) return true
  const acquired = deps.requestSingleInstanceLock()
  if (!acquired) {
    deps.quit()
    return false
  }
  deps.onSecondInstance(() => { deps.focusMainWindow?.() })
  return true
}
