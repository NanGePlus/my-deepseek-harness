import { describe, expect, it } from 'vitest'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import {
  joinChildPath, parentDirectoryForCreate, siblingNameExists,
} from '../src/client/file-tree-parent.ts'

const ROOT = '/w/alpha'

function entry(name: string, isDirectory: boolean): WorkspaceEntry {
  return { name, path: `${ROOT}/${name}`, isDirectory, hidden: false }
}

describe('file-tree-parent helpers', () => {
  it('uses the workspace root when nothing is selected', () => {
    expect(parentDirectoryForCreate(ROOT, undefined)).toBe(ROOT)
  })

  it('uses a selected directory as the create parent', () => {
    expect(parentDirectoryForCreate(ROOT, entry('src', true))).toBe(`${ROOT}/src`)
  })

  it('uses the parent of a selected file as the create parent', () => {
    expect(parentDirectoryForCreate(ROOT, entry('README.md', false))).toBe(ROOT)
  })

  it('joins a parent directory and child segment', () => {
    expect(joinChildPath(`${ROOT}/src`, 'app.ts')).toBe(`${ROOT}/src/app.ts`)
  })

  it('detects sibling name collisions', () => {
    const siblings = [entry('README.md', false), entry('src', true)]
    expect(siblingNameExists(siblings, 'README.md')).toBe(true)
    expect(siblingNameExists(siblings, 'notes.ts')).toBe(false)
  })
})
