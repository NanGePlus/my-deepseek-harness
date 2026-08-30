import { describe, expect, it } from 'vitest'
import { apply } from '../src/invariant.ts'

describe('ui-browser invariant', () => {
  it('exports a named companion apply', () => {
    expect(typeof apply).toBe('function')
  })
})
