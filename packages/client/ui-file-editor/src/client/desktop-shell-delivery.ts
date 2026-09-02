/** Whether the SPA runs inside the integrated desktop shell (not attach / web). */

/**
 * True when preload exposed `window.dsh.delivery === 'desktop'`.
 */
export function isDesktopShellDelivery(): boolean {
  if (typeof window === 'undefined') return false
  const dsh = (window as Window & { dsh?: { delivery?: string } }).dsh
  return dsh?.delivery === 'desktop'
}
