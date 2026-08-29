/** Subscribe to Harness light/dark via ui-theme's body attribute. */

import { useEffect, useState } from 'react'

/** Document attribute that ui-theme sets for the Harness dark palette. */
export const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/**
 * Track whether the Harness document is in dark mode.
 * @returns true when `body[data-ds-dark-theme]` is present.
 */
export function useHarnessDark(): boolean {
  const [dark, setDark] = useState(() => document.body.hasAttribute(DARK_ATTRIBUTE))
  useEffect(() => {
    const sync = (): void => { setDark(document.body.hasAttribute(DARK_ATTRIBUTE)) }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: [DARK_ATTRIBUTE] })
    return () => { observer.disconnect() }
  }, [])
  return dark
}
