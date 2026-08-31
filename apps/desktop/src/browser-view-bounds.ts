/**
 * Browser occupant bounds reported from the Renderer toolbox browser segment.
 * @module @deepseek-ai/dsh-desktop-shell/browser-view-bounds
 */

/** Screen-space rectangle for one embedded browser occupant. */
export interface BrowserOccupantBounds {
  x: number
  y: number
  width: number
  height: number
  /** When false, Main detaches the BrowserView. */
  visible: boolean
}

/** Minimal BrowserView surface exercised by bounds seam tests. */
export interface BrowserViewLike {
  setBounds(bounds: { x: number; y: number; width: number; height: number }): void
}

/** Minimal host window that can attach or detach one BrowserView. */
export interface BrowserViewHost {
  addBrowserView(view: BrowserViewLike): void
  removeBrowserView(view: BrowserViewLike): void
}

/** Tracks whether one BrowserView is currently attached to the host window. */
export interface BrowserViewAttachmentState {
  attached: boolean
}

/**
 * Apply one occupant bounds update: attach + setBounds, or detach when hidden.
 * @param host - Electron BrowserWindow or test double.
 * @param view - BrowserView or test double.
 * @param state - mutable attachment flag shared across updates.
 * @param bounds - Renderer-reported screen coordinates.
 */
export function applyBrowserOccupantBounds(
  host: BrowserViewHost,
  view: BrowserViewLike,
  state: BrowserViewAttachmentState,
  bounds: BrowserOccupantBounds,
): void {
  if (!bounds.visible || bounds.width <= 0 || bounds.height <= 0) {
    if (state.attached) {
      host.removeBrowserView(view)
      state.attached = false
    }
    return
  }
  if (!state.attached) {
    host.addBrowserView(view)
    state.attached = true
  }
  view.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  })
}
