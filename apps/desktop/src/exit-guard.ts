/**
 * Main-process quit coordination with Renderer exit guard.
 * @module @deepseek-ai/dsh-desktop-shell/exit-guard
 */

/** Renderer → Main exit-guard decision. */
export interface ExitGuardResult {
  /** Whether Main may teardown Host and exit. */
  proceed: boolean
}

/** Injectable dependencies for {@link createExitGuardCoordinator}. */
export interface ExitGuardCoordinatorDeps {
  /** Notify Renderer to run dirty-editor exit guard. */
  sendExitRequest: () => void
  /** Stop integrated Host after guard passes. */
  teardownHost: () => void
  /** Attach mode exits GUI only. */
  isAttachMode: () => boolean
}

/** Coordinates quit requests with Renderer dirty-editor guard. */
export interface ExitGuardCoordinator {
  /** Begin quit flow; resolves when guard completes or is cancelled. */
  requestQuit(): Promise<boolean>
  /** Apply Renderer guard result to a pending quit. */
  handleExitGuardResult(result: ExitGuardResult): void
}

/**
 * Create the Main exit-guard coordinator.
 * @param deps - IPC + Host lifecycle hooks.
 * @returns coordinator instance.
 */
export function createExitGuardCoordinator(deps: ExitGuardCoordinatorDeps): ExitGuardCoordinator {
  let pending: ((proceed: boolean) => void) | undefined

  return {
    requestQuit() {
      return new Promise<boolean>((resolve) => {
        pending = resolve
        deps.sendExitRequest()
      })
    },
    handleExitGuardResult(result) {
      const resolve = pending
      pending = undefined
      if (resolve === undefined) return
      if (result.proceed && !deps.isAttachMode()) deps.teardownHost()
      resolve(result.proceed)
    },
  }
}
