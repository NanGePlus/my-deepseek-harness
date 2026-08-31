/**
 * Host boot failure wire injection for desktop SPA loud error.
 * @module @deepseek-ai/dsh-desktop-shell/host-boot-wire
 */

/** Wire shape injected as `window.__DSH_HOST_BOOT__` before the SPA shell boots. */
export interface HostBootWire {
  /** False when Main failed to boot the integrated Host. */
  ok: boolean
  /** Human-readable boot failure reason. */
  error?: string
}

/**
 * Inject host boot status beside the SPA boot manifest.
 * @param html - index.html source.
 * @param wire - host boot wire payload.
 * @returns html with the host boot script in `<head>`.
 */
export function injectHostBootWire(html: string, wire: HostBootWire): string {
  const json = JSON.stringify(wire).replaceAll('<', '\\u003c')
  const script = `<script>window.__DSH_HOST_BOOT__ = ${json}</script>`
  const head = html.indexOf('<head>')
  if (head !== -1) return `${html.slice(0, head + 6)}${script}${html.slice(head + 6)}`
  return `${script}${html}`
}

/** Failure wire for integrated Host boot errors. */
export function hostBootFailureWire(error: string): HostBootWire {
  return { ok: false, error }
}

/** Success wire for integrated or attach mode. */
export function hostBootSuccessWire(): HostBootWire {
  return { ok: true }
}
