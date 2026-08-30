/** Drop xterm emulator protocol traffic before it reaches the Host PTY. */

const ESC = '\x1b'
const ST = `${ESC}\\`

/**
 * True when one parsed escape sequence should reach the shell PTY.
 * @param sequence - one ESC/ST/CSI/OSC/DCS chunk starting at ESC or OSC introducer.
 */
export function shouldForwardEscapeSequence(sequence: string): boolean {
  if (sequence.length === 0) return false
  if (sequence.startsWith(`${ESC}]`) || sequence.startsWith('\x9d')) return false
  if (sequence.startsWith(`${ESC}P`)) return false
  if (sequence.startsWith(`${ESC}[`)) {
    if (/^\x1b\[\d*(;\d*)?R$/.test(sequence)) return false
    if (/^\x1b\[\??[\d;]*c$/.test(sequence)) return false
    if (/^\x1b\[\d+n$/.test(sequence)) return false
    if (/^\x1b\[[\?$][\d;]*\$[a-zA-Z]$/.test(sequence)) return false
    if (/^\x1b\[>/.test(sequence)) return false
    if (sequence === `${ESC}[c` || sequence === `${ESC}[0c`) return false
    if (/^\x1b\[\?[\d;]*c$/.test(sequence)) return false
    if (/^\x1b\[\?[\d;]*h$/.test(sequence)) return false
    if (/^\x1b\[\?[\d;]*l$/.test(sequence)) return false
    if (/^\x1b\[\?[\d;]*n$/.test(sequence)) return false
  }
  return true
}

/**
 * End index (exclusive) of one escape sequence starting at `start`.
 * @param data - full xterm onData payload.
 * @param start - index of ESC or OSC introducer.
 */
function escapeSequenceEnd(data: string, start: number): number {
  const code = data.charCodeAt(start)
  if (code === 0x9d) {
    const bel = data.indexOf('\x07', start + 1)
    const st = data.indexOf(ST, start + 1)
    if (bel === -1 && st === -1) return data.length
    if (bel === -1) return st + ST.length
    if (st === -1) return bel + 1
    return Math.min(bel, st) + (bel < st ? 1 : ST.length)
  }
  if (!data.startsWith(ESC, start)) return start + 1
  if (data.startsWith(`${ESC}]`, start)) {
    const bel = data.indexOf('\x07', start + 2)
    const st = data.indexOf(ST, start + 2)
    if (bel === -1 && st === -1) return data.length
    if (bel === -1) return st + ST.length
    if (st === -1) return bel + 1
    return Math.min(bel, st) + (bel < st ? 1 : ST.length)
  }
  if (data.startsWith(`${ESC}P`, start)) {
    const st = data.indexOf(ST, start + 2)
    return st === -1 ? data.length : st + ST.length
  }
  if (data.startsWith(`${ESC}[`, start)) {
    for (let i = start + 2; i < data.length; i += 1) {
      const ch = data.charCodeAt(i)
      if (ch >= 0x40 && ch <= 0x7e) return i + 1
    }
    return data.length
  }
  if (data.startsWith(`${ESC}O`, start) && start + 2 < data.length) return start + 3
  return start + 2
}

/**
 * Remove emulator query/response sequences from an xterm onData payload.
 * @param data - raw onData text from xterm.js.
 */
export function filterXtermPtyInput(data: string): string {
  if (data.length === 0) return ''
  let out = ''
  let i = 0
  while (i < data.length) {
    const code = data.charCodeAt(i)
    if (code !== 0x1b && code !== 0x9d) {
      let j = i + 1
      while (j < data.length) {
        const next = data.charCodeAt(j)
        if (next === 0x1b || next === 0x9d) break
        j += 1
      }
      out += data.slice(i, j)
      i = j
      continue
    }
    const end = escapeSequenceEnd(data, i)
    const sequence = data.slice(i, end)
    if (shouldForwardEscapeSequence(sequence)) out += sequence
    i = end
  }
  return out
}
