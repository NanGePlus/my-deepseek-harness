import { describe, expect, it } from 'vitest'
import { filterXtermPtyInput, shouldForwardEscapeSequence } from '../src/client/xterm-pty-input-filter.ts'

describe('xterm-pty-input-filter', () => {
  it('forwards ordinary text and user CSI input', () => {
    expect(filterXtermPtyInput('ls\n')).toBe('ls\n')
    expect(filterXtermPtyInput('\x1b[A')).toBe('\x1b[A')
    expect(shouldForwardEscapeSequence('\x1b[A')).toBe(true)
  })

  it('drops OSC color query responses', () => {
    const bg = '\x1b]11;rgb:f6f6/f8f8/fafa\x1b\\'
    const fg = '\x1b]10;rgb:2626/2626/2626\x1b\\'
    expect(filterXtermPtyInput(bg)).toBe('')
    expect(filterXtermPtyInput(fg)).toBe('')
    expect(filterXtermPtyInput(`${bg}${fg}`)).toBe('')
  })

  it('drops DA, CPR, and xterm capability replies', () => {
    expect(filterXtermPtyInput('\x1b[0;276;0c')).toBe('')
    expect(filterXtermPtyInput('\x1b[24;5R')).toBe('')
    expect(filterXtermPtyInput('\x1b[>2;2$y')).toBe('')
    expect(filterXtermPtyInput('\x1b[2R\x1b[1R')).toBe('')
  })

  it('drops emulator-initiated queries', () => {
    expect(filterXtermPtyInput('\x1b]11;?\x07')).toBe('')
    expect(filterXtermPtyInput('\x1b[c')).toBe('')
  })

  it('preserves user bytes interleaved with dropped protocol noise', () => {
    const noisy = '\x1b]11;rgb:f6f6/f8f8/fafa\x1b\\pwd\n'
    expect(filterXtermPtyInput(noisy)).toBe('pwd\n')
  })
})
