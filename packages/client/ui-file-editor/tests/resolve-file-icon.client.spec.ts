// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import { FILE_ICON_BASE_URL } from '../src/client/file-icon-base.ts'
import { fileIconUrlForEntry } from '../src/client/resolve-file-icon.ts'

function entry(overrides: Partial<WorkspaceEntry> & Pick<WorkspaceEntry, 'name' | 'path'>): WorkspaceEntry {
  return {
    isDirectory: false,
    hidden: false,
    ...overrides,
  }
}

describe('fileIconUrlForEntry', () => {
  it('maps common source and config files to Material icons', () => {
    expect(fileIconUrlForEntry(entry({ name: 'index.ts', path: '/ws/src/index.ts' }), false))
      .toBe(`${FILE_ICON_BASE_URL}/typescript.svg`)
    expect(fileIconUrlForEntry(entry({ name: 'package.json', path: '/ws/package.json' }), false))
      .toBe(`${FILE_ICON_BASE_URL}/nodejs.svg`)
    expect(fileIconUrlForEntry(entry({ name: '.gitignore', path: '/ws/.gitignore' }), false))
      .toBe(`${FILE_ICON_BASE_URL}/git.svg`)
    expect(fileIconUrlForEntry(entry({ name: 'AGENTS.md', path: '/ws/AGENTS.md' }), false))
      .toBe(`${FILE_ICON_BASE_URL}/markdown.svg`)
  })

  it('maps directories and uses open variants when expanded', () => {
    const folder = entry({ name: 'src', path: '/ws/src', isDirectory: true })
    expect(fileIconUrlForEntry(folder, false)).toBe(`${FILE_ICON_BASE_URL}/folder-src.svg`)
    expect(fileIconUrlForEntry(folder, true)).toBe(`${FILE_ICON_BASE_URL}/folder-src-open.svg`)
  })

  it('falls back to a generic icon for unknown extensions', () => {
    expect(fileIconUrlForEntry(entry({ name: 'scratch.unknown-ext', path: '/ws/scratch.unknown-ext' }), false))
      .toBe(`${FILE_ICON_BASE_URL}/document.svg`)
  })
})
