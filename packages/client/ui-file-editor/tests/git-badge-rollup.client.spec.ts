import { describe, expect, it } from 'vitest'
import { rollupGitBadges } from '../src/client/git-badge-rollup.ts'

const ROOT = '/w/alpha'

describe('rollupGitBadges', () => {
  it('copies a nested untracked letter onto ancestor folders', () => {
    const rolled = rollupGitBadges(
      new Map([[`${ROOT}/hahah/test.md`, 'U']]),
      ROOT,
    )
    expect(rolled.get(`${ROOT}/hahah/test.md`)).toBe('U')
    expect(rolled.get(`${ROOT}/hahah`)).toBe('U')
    expect(rolled.get(ROOT)).toBe('U')
  })

  it('prefers M over U when a folder has mixed descendants', () => {
    const rolled = rollupGitBadges(
      new Map([
        [`${ROOT}/src/new.ts`, 'U'],
        [`${ROOT}/src/app.ts`, 'M'],
      ]),
      ROOT,
    )
    expect(rolled.get(`${ROOT}/src`)).toBe('M')
  })
})
