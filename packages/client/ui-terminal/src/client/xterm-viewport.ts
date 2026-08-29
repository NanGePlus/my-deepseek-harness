/** Imperative xterm viewport wrapper for tests and TerminalPanel. */

import './xterm.css'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { harnessXtermFont, harnessXtermTheme } from './xterm-theme.ts'

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
  /** Apply a Harness theme refresh. */
  setDark(dark: boolean): void
  /** Reflow to the host size and emit resize when dimensions change. */
  fit(): void
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
    convertEol: true,
    scrollback: 5000,
  })
  const fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.onData(options.onInput)
  let lastCols = 0
  let lastRows = 0
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
    },
    write(text) {
      terminal.write(text)
    },
    reset() {
      terminal.write('\x1bc')
    },
    setDark(dark) {
      terminal.options.theme = harnessXtermTheme(dark)
    },
    fit: emitResize,
    dispose() {
      terminal.dispose()
    },
  }
}
