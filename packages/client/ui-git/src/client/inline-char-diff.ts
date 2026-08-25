/** Character-level spans for one modified diff line pair. */

export interface CharSpan {
  kind: 'same' | 'insert' | 'delete'
  text: string
}

/**
 * Split one old/new line pair into highlighted character spans.
 * @param oldText - removed line body without the diff prefix.
 * @param newText - added line body without the diff prefix.
 */
export function charDiffPair(oldText: string, newText: string): { old: CharSpan[]; new: CharSpan[] } {
  if (oldText === newText) {
    return {
      old: [{ kind: 'same', text: oldText }],
      new: [{ kind: 'same', text: newText }],
    }
  }
  let start = 0
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
    start++
  }
  let oldEnd = oldText.length
  let newEnd = newText.length
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  const prefix = oldText.slice(0, start)
  const suffix = oldText.slice(oldEnd)
  const oldMid = oldText.slice(start, oldEnd)
  const newMid = newText.slice(start, newEnd)
  return {
    old: joinSpans(prefix, oldMid === '' ? [] : [{ kind: 'delete', text: oldMid }], suffix),
    new: joinSpans(prefix, newMid === '' ? [] : [{ kind: 'insert', text: newMid }], suffix),
  }
}

function joinSpans(prefix: string, middle: CharSpan[], suffix: string): CharSpan[] {
  const spans: CharSpan[] = []
  if (prefix !== '') spans.push({ kind: 'same', text: prefix })
  spans.push(...middle)
  if (suffix !== '') spans.push({ kind: 'same', text: suffix })
  return spans.length === 0 ? [{ kind: 'same', text: '' }] : spans
}
