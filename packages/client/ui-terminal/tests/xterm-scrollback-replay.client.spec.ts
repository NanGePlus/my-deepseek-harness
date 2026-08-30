// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createXtermViewport } from '../src/client/xterm-viewport.ts'
import {
  sanitizeTerminalScrollbackForReplay,
  waitForXtermViewportFit,
} from '../src/client/xterm-scrollback-replay.ts'

/** Captured from login zsh via node-pty at 80 cols (PROMPT_SP before each prompt). */
const ZSH_LOGIN_PROMPT_SP = [
  '\x1b[1m\x1b[7m%\x1b[27m\x1b[1m\x1b[0m',
  `${' '.repeat(79)}\r \r\r`,
  '\x1b[0m\x1b[27m\x1b[24m\x1b[J',
  '(base) nange@NanGedeMacBook-Air my-deepseek-harness % ',
].join('')

describe('sanitizeTerminalScrollbackForReplay', () => {
  it('strips the login-zsh PROMPT_SP sequence captured from a real PTY', () => {
    const raw = `cd .\r\n${ZSH_LOGIN_PROMPT_SP}`
    const sanitized = sanitizeTerminalScrollbackForReplay(raw)
    expect(sanitized).not.toMatch(/\x1b\[7m%/)
    expect(sanitized).toContain('(base) nange@NanGedeMacBook-Air my-deepseek-harness % ')
    expect(sanitized).toContain('cd .\r\n')
  })

  it('removes the short inverse-video mark variant', () => {
    const raw = 'ls output\n\x1b[7m%\x1b[0m \r(base) nange@host dir % '
    expect(sanitizeTerminalScrollbackForReplay(raw)).toBe('ls output\n(base) nange@host dir % ')
  })
})

describe('waitForXtermViewportFit', () => {
  it('resolves once the host gains non-zero layout size', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const viewport = createXtermViewport({ dark: false, onInput: () => {}, onResize: () => {} })
    viewport.attach(host)
    const ac = new AbortController()
    const pending = waitForXtermViewportFit(() => viewport.fit(), host, ac.signal)
    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true })
    await new Promise<void>((resolve) => { requestAnimationFrame(() => { resolve() }) })
    const dims = await pending
    document.body.removeChild(host)
    viewport.dispose()
    expect(dims).not.toBeNull()
    expect(dims!.cols).toBeGreaterThan(0)
    expect(dims!.rows).toBeGreaterThan(0)
  })
})
