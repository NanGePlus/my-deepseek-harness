/** Imperative xterm viewport wrapper for tests and TerminalPanel. */

import './xterm.css'
import { attachXtermHostScrollReveal } from './xterm-scroll-reveal.ts'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { harnessXtermFont, harnessXtermTheme } from './xterm-theme.ts'
import { filterXtermPtyInput } from './xterm-pty-input-filter.ts'
import { attachXtermImeGate, collapseImeLatinSpacing, type XtermImeGate } from './xterm-ime-input.ts'

/** Options for {@link createXtermViewport}. */
export interface XtermViewportOptions {
  /** Harness dark mode flag. */
  dark: boolean
  /**
   * Keyboard/paste stdin callback.
   * @param data - UTF-8 payload from xterm.
   */
  onInput: (data: string) => void
  /**
   * Resize callback after FitAddon reflow.
   * @param cols - terminal column count.
   * @param rows - terminal row count.
   */
  onResize: (cols: number, rows: number) => void
}

/** Handle returned by {@link createXtermViewport}. */
export interface XtermViewportHandle {
  /** Mount the terminal into a DOM host element. */
  attach(host: HTMLElement): void
  /** Write PTY output bytes. */
  write(text: string): void
  /** Clear the screen and scrollback before a Host scrollback replay. */
  reset(): void
  /** Gate keyboard/paste forwarding until scrollback replay finishes. */
  setInputEnabled(enabled: boolean): void
  /** Apply a Harness theme refresh. */
  setDark(dark: boolean): void
  /** Reflow to the host size, emit resize when dimensions change, and return the active size. */
  fit(): { cols: number; rows: number } | null
  /** Release xterm resources. */
  dispose(): void
}

/**
 * Create one xterm viewport with FitAddon wiring.
 * @param options - theme, stdin, and resize callbacks.
 * @returns an imperative viewport handle.
 */
export function createXtermViewport(options: XtermViewportOptions): XtermViewportHandle {
  const font = harnessXtermFont()
  const terminal = new Terminal({
    ...font,
    theme: harnessXtermTheme(options.dark),
    cursorBlink: true,
    scrollback: 5000,
    disableStdin: true,
  })
  const fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  let imeGate: XtermImeGate | undefined
  const sendToPty = (data: string): void => {
    const filtered = filterXtermPtyInput(data)
    const normalized = collapseImeLatinSpacing(filtered)
    if (normalized.length > 0) options.onInput(normalized)
  }
  terminal.onData((data) => {
    if (imeGate?.isComposing() === true) return
    sendToPty(data)
  })
  let lastCols = 0
  let lastRows = 0
  let scrollRevealDispose: (() => void) | undefined
  const emitResize = (): void => {
    const element = terminal.element
    if (element === undefined) return
    const { clientWidth, clientHeight } = element
    if (clientWidth === 0 || clientHeight === 0) return
    try {
      fitAddon.fit()
    } catch {
      return
    }
    const cols = terminal.cols
    const rows = terminal.rows
    if (cols === lastCols && rows === lastRows) return
    lastCols = cols
    lastRows = rows
    options.onResize(cols, rows)
  }
  return {
    attach(host) {
      terminal.open(host)
      imeGate?.dispose()
      if (terminal.textarea !== undefined) {
        imeGate = attachXtermImeGate(terminal.textarea)
      }
      scrollRevealDispose?.()
      scrollRevealDispose = undefined
      host.removeAttribute('data-dsh-scroll-reveal-active')
      scrollRevealDispose = attachXtermHostScrollReveal(host)
    },
    write(text) {
      terminal.write(text)
    },
    reset() {
      terminal.reset()
    },
    setInputEnabled(enabled) {
      terminal.options.disableStdin = !enabled
    },
    setDark(dark) {
      terminal.options.theme = harnessXtermTheme(dark)
    },
    fit() {
      emitResize()
      if (lastCols === 0 || lastRows === 0) return null
      return { cols: lastCols, rows: lastRows }
    },
    dispose() {
      scrollRevealDispose?.()
      scrollRevealDispose = undefined
      imeGate?.dispose()
      imeGate = undefined
      terminal.dispose()
    },
  }
}
