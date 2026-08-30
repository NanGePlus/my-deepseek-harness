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
  reset(): void
  setInputEnabled(enabled: boolean): void
  setDark(dark: boolean): void
  fit(): { cols: number; rows: number } | null
  dispose(): void
}

export const createXtermViewport: Mock<(options: XtermViewportOptions) => XtermViewportHandle> = vi.fn(() => ({
  attach: vi.fn(),
  write: vi.fn(),
  reset: vi.fn(),
  setInputEnabled: vi.fn(),
  setDark: vi.fn(),
  fit: vi.fn((): { cols: number; rows: number } | null => ({ cols: 80, rows: 24 })),
  dispose: vi.fn(),
}))
