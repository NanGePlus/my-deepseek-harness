import { describe, expect, it } from 'vitest'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import { filterTreeEntries, isTreeVisibleEntry } from '../src/client/tree-entry-filter.ts'

function row(name: string): WorkspaceEntry {
  return { name, path: `/w/${name}`, isDirectory: false, hidden: name.startsWith('.') }
}

describe('tree-entry-filter', () => {
  it('drops macOS and Windows metadata names while keeping project dotfiles', () => {
    expect(isTreeVisibleEntry(row('.DS_Store'))).toBe(false)
    expect(isTreeVisibleEntry(row('Thumbs.db'))).toBe(false)
    expect(isTreeVisibleEntry(row('desktop.ini'))).toBe(false)
    expect(isTreeVisibleEntry(row('._Resource'))).toBe(false)
    expect(isTreeVisibleEntry(row('.gitignore'))).toBe(true)
    expect(isTreeVisibleEntry(row('.git'))).toBe(true)
    expect(isTreeVisibleEntry(row('README.md'))).toBe(true)
  })

  it('filters one listing level', () => {
    expect(filterTreeEntries([
      row('README.md'),
      row('.DS_Store'),
      row('.git'),
      row('._foo'),
    ]).map(entry => entry.name)).toEqual(['README.md', '.git'])
  })
})
