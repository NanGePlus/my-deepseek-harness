/**
 * Boot and teardown the desktop profile Host from Electron Main (or tests).
 * @module @deepseek-ai/dsh-desktop-shell/host-boot
 */

import type { Context } from '@deepseek-ai/cordis'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { runProfile, type RunProfileOptions } from '../../cli/src/profile-boot.ts'
import type { ProcessShutdown } from '../../cli/src/process-shutdown.ts'

/** Options for {@link DesktopHostController.boot}. */
export interface DesktopHostBootOptions {
  /** Workspace directory; tests set an isolated temp root. */
  workspace?: string
}

/** Settled desktop Host boot. */
export interface DesktopHostBootResult {
  ctx: Context
  shutdown: ProcessShutdown
}

/** Owns one desktop-profile Host boot lifecycle for Electron Main. */
export class DesktopHostController {
  private ctx: Context | undefined
  private shutdown: ProcessShutdown | undefined

  /** Whether a Host boot is currently held. */
  get isBooted(): boolean {
    return this.ctx !== undefined
  }

  /** The booted root context; undefined before boot or after teardown. */
  get context(): Context | undefined {
    return this.ctx
  }

  /**
   * Boot the desktop profile Host (App `ready` default path).
   * @param options - optional isolated workspace for tests.
   * @returns the settled root context and shutdown controller.
   */
  async boot(options: DesktopHostBootOptions = {}): Promise<DesktopHostBootResult> {
    if (this.ctx !== undefined) throw new Error('desktop host: already booted')
    const previousCwd = process.cwd()
    if (options.workspace !== undefined) process.chdir(options.workspace)
    try {
      const runOptions: RunProfileOptions = {
        environment: loadLayeredEnv('dsh'),
        profile: 'desktop',
        patchFiles: [],
        args: [],
      }
      const result = await runProfile(runOptions)
      this.ctx = result.ctx
      this.shutdown = result.shutdown
      return result
    } finally {
      if (options.workspace !== undefined) process.chdir(previousCwd)
    }
  }

  /** Tear down the Host (`before-quit` path). */
  async teardown(): Promise<void> {
    const ctx = this.ctx
    if (ctx === undefined) return
    if (this.shutdown !== undefined) await this.shutdown.shutdown(0)
    else await ctx.fiber.dispose()
    this.ctx = undefined
    this.shutdown = undefined
  }
}
