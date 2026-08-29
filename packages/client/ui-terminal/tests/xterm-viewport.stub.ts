/** Vitest stand-in for xterm viewport wiring. */

import { vi, type Mock } from 'vitest'

/** Options passed to {@link createXtermViewport} in production. */
interface XtermViewportOptions {
  dark: boolean
  onInput: (data: string) => void
  onResize: (cols: number, rows: number) => void
}

/** Handle returned by {@link createXtermViewport} in production. */
interface XtermViewportHandle {
  attach(host: HTMLElement): void
  write(text: string): void
  setDark(dark: boolean): void
  fit(): void
  dispose(): void
}

export const createXtermViewport: Mock<(options: XtermViewportOptions) => XtermViewportHandle> = vi.fn(() => ({
  attach: vi.fn(),
  write: vi.fn(),
  setDark: vi.fn(),
  fit: vi.fn(),
  dispose: vi.fn(),
}))
