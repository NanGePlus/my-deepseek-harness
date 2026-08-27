import { describe, expect, it } from 'vitest'
import {
  formatAbsoluteCommitDate, formatRelativeCommitAge, gitGraphCardPosition, relativeCommitAge,
} from '../src/client/git-graph-card.ts'

describe('relativeCommitAge', () => {
  const now = Date.parse('2026-08-27T10:06:00.000Z')

  it('classifies month and year buckets', () => {
    expect(relativeCommitAge('2026-02-27T10:06:00.000Z', now)).toEqual({ kind: 'monthsAgo', count: 6 })
    expect(relativeCommitAge('2024-08-27T10:06:00.000Z', now)).toEqual({ kind: 'yearsAgo', count: 2 })
  })

  it('treats invalid and future instants as just now', () => {
    expect(relativeCommitAge('not-a-date', now)).toEqual({ kind: 'justNow' })
    expect(relativeCommitAge('2026-08-27T12:00:00.000Z', now)).toEqual({ kind: 'justNow' })
  })
})

describe('formatRelativeCommitAge', () => {
  const now = Date.parse('2026-08-27T10:06:00.000Z')
  const t = (key: string, params?: { count?: string }): string =>
    params?.count === undefined ? key : `${key}:${params.count}`

  it('maps each bucket onto a locale key', () => {
    expect(formatRelativeCommitAge('2026-08-27T10:05:50.000Z', now, t)).toBe('git.graph.card.justNow')
    expect(formatRelativeCommitAge('2026-08-27T10:01:00.000Z', now, t)).toBe('git.graph.card.minutesAgo:5')
    expect(formatRelativeCommitAge('2026-08-27T07:06:00.000Z', now, t)).toBe('git.graph.card.hoursAgo:3')
    expect(formatRelativeCommitAge('2026-08-25T10:06:00.000Z', now, t)).toBe('git.graph.card.daysAgo:2')
    expect(formatRelativeCommitAge('2026-02-27T10:06:00.000Z', now, t)).toBe('git.graph.card.monthsAgo:6')
    expect(formatRelativeCommitAge('2024-08-27T10:06:00.000Z', now, t)).toBe('git.graph.card.yearsAgo:2')
  })
})

describe('formatAbsoluteCommitDate', () => {
  it('returns the input when the timestamp is invalid', () => {
    expect(formatAbsoluteCommitDate('not-a-date')).toBe('not-a-date')
  })

  it('formats a valid timestamp with the locale long date', () => {
    expect(formatAbsoluteCommitDate('2026-08-27T02:06:00.000Z')).toMatch(/2026/)
  })
})

describe('gitGraphCardPosition', () => {
  it('opens to the right of the pill when there is room', () => {
    expect(gitGraphCardPosition(
      { left: 20, right: 80, top: 40 },
      { width: 800, height: 600 },
    )).toEqual({ left: 88, top: 40, maxHeight: 360 })
  })

  it('clamps a left flip to the viewport inset and shrinks on a short viewport', () => {
    expect(gitGraphCardPosition(
      { left: 10, right: 790, top: 20 },
      { width: 800, height: 200 },
    )).toEqual({ left: 12, top: 12, maxHeight: 176 })
  })
})
