/** Debounced viewport resize scheduling for Host browserResizeViewport calls. */

/** Default debounce interval for screencast viewport sync (milliseconds). */
export const VIEWPORT_RESIZE_DEBOUNCE_MS = 150

/** Timer primitives injected for testability. */
export interface ViewportResizeScheduler {
  schedule: (fn: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  cancel: (handle: ReturnType<typeof setTimeout>) => void
}

/** Default browser timer primitives. */
export const defaultViewportResizeScheduler: ViewportResizeScheduler = {
  schedule: (fn, delayMs) => setTimeout(fn, delayMs),
  cancel: (handle) => { clearTimeout(handle) },
}

/**
 * Arm a debounced viewport resize callback; successive arms reset the timer.
 * @param onResize - invoked after the debounce window elapses with no further arms.
 * @param debounceMs - debounce interval in milliseconds.
 * @param scheduler - timer primitives (defaults to browser timers).
 * @returns arm and dispose controls.
 */
export function createViewportResizeDebouncer(
  onResize: () => void,
  debounceMs = VIEWPORT_RESIZE_DEBOUNCE_MS,
  scheduler: ViewportResizeScheduler = defaultViewportResizeScheduler,
): { arm: () => void; dispose: () => void } {
  let pending: ReturnType<typeof setTimeout> | undefined
  return {
    arm: () => {
      if (pending !== undefined) scheduler.cancel(pending)
      pending = scheduler.schedule(() => {
        pending = undefined
        onResize()
      }, debounceMs)
    },
    dispose: () => {
      if (pending !== undefined) scheduler.cancel(pending)
      pending = undefined
    },
  }
}

/** Read integer pixel dimensions from a content host element. */
export function readViewportContentSize(host: HTMLElement): { width: number; height: number } | null {
  const width = Math.floor(host.clientWidth)
  const height = Math.floor(host.clientHeight)
  if (width <= 0 || height <= 0) return null
  return { width, height }
}
