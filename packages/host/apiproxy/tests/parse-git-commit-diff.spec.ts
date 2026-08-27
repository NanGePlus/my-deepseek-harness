import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import { GitCommandFailedError } from '../src/git-working-tree.ts'
import { parseNameStatus, readGitCommitDiff } from '../src/git-commit-diff.ts'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempRepo(): string {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-git-commit-diff-')))
  dirs.push(dir)
  execSync('git init -b main', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.name "Test User"', { cwd: dir, stdio: 'ignore' })
  return dir
}

function git(dir: string, args: string): string {
  return execSync(`git ${args}`, { cwd: dir, encoding: 'utf8' }).trim()
}

describe('parseNameStatus', () => {
  it('maps add, modify, delete, rename, copy, and type-change letters', () => {
    expect(parseNameStatus([
      'A\tnew.ts',
      'M\tkeep.ts',
      'D\tgone.ts',
      'R100\told.ts\trenamed.ts',
      'C80\tsrc.ts\tcopy.ts',
      'T\tmode.ts',
      'U\tunmerged.ts',
      'X\tskipped.ts',
      '',
    ].join('\n'))).toEqual([
      { status: 'added', path: 'new.ts' },
      { status: 'modified', path: 'keep.ts' },
      { status: 'deleted', path: 'gone.ts' },
      { status: 'renamed', path: 'renamed.ts' },
      { status: 'added', path: 'copy.ts' },
      { status: 'modified', path: 'mode.ts' },
      { status: 'modified', path: 'unmerged.ts' },
    ])
  })

  it('parses NUL-delimited rename and skip empty records', () => {
    expect(parseNameStatus(['M', 'a.ts', 'R100', 'old.ts', 'new.ts', '', 'C80', 'src.ts', 'copy.ts', 'A', 'b.ts', ''].join('\0'))).toEqual([
      { status: 'modified', path: 'a.ts' },
      { status: 'renamed', path: 'new.ts' },
      { status: 'added', path: 'copy.ts' },
      { status: 'added', path: 'b.ts' },
    ])
  })

  it('skips a rename whose new path is missing', () => {
    expect(parseNameStatus('R100\told.ts')).toEqual([])
    expect(parseNameStatus(['R100', 'old.ts'].join('\0'))).toEqual([])
  })
})

describe('readGitCommitDiff', () => {
  it('returns not-a-repository or git-unavailable for a non-repo directory', async () => {
    const result = await readGitCommitDiff(tmpdir(), 'HEAD', new AbortController().signal)
    expect(result.availability === 'not-a-repository' || result.availability === 'git-unavailable').toBe(true)
  })

  it('maps a non-repository stderr to not-a-repository', async () => {
    const run: NativeCommandRunner = async () => {
      throw Object.assign(new Error('fatal: not a git repository'), {
        stderr: 'fatal: not a git repository (or any of the parent directories): .git',
      })
    }
    await expect(readGitCommitDiff(tmpdir(), 'abc1234', new AbortController().signal, run))
      .resolves.toEqual({ availability: 'not-a-repository' })
  })

  it('maps missing git to git-unavailable', async () => {
    const run: NativeCommandRunner = async () => {
      throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
    }
    await expect(readGitCommitDiff(tmpdir(), 'abc1234', new AbortController().signal, run))
      .resolves.toEqual({ availability: 'git-unavailable' })
  })

  it('rethrows when the caller aborts', async () => {
    const ac = new AbortController()
    ac.abort()
    const run: NativeCommandRunner = async () => {
      throw new Error('killed')
    }
    await expect(readGitCommitDiff(tmpdir(), 'abc1234', ac.signal, run)).rejects.toThrow('killed')
  })

  it('wraps unexpected git failures as GitCommandFailedError', async () => {
    const run: NativeCommandRunner = async () => {
      throw Object.assign(new Error('bad'), { stderr: 'fatal: ambiguous argument' })
    }
    await expect(readGitCommitDiff(tmpdir(), 'notahash', new AbortController().signal, run))
      .rejects.toMatchObject({ name: 'GitCommandFailedError', message: 'fatal: ambiguous argument' })
  })

  it('rethrows an existing GitCommandFailedError', async () => {
    const run: NativeCommandRunner = async () => {
      throw new GitCommandFailedError('already typed')
    }
    await expect(readGitCommitDiff(tmpdir(), 'abc', new AbortController().signal, run))
      .rejects.toMatchObject({ message: 'already typed' })
  })

  it('uses Error.message when stderr is empty', async () => {
    const run: NativeCommandRunner = async () => {
      throw new Error('no stderr')
    }
    await expect(readGitCommitDiff(tmpdir(), 'abc', new AbortController().signal, run))
      .rejects.toMatchObject({ name: 'GitCommandFailedError', message: 'no stderr' })
  })

  it('stringifies a non-Error rejection', async () => {
    const run: NativeCommandRunner = async () => {
      throw 7
    }
    await expect(readGitCommitDiff(tmpdir(), 'abc', new AbortController().signal, run))
      .rejects.toMatchObject({ name: 'GitCommandFailedError', message: '7' })
  })

  it('reads added, modified, and deleted text on a non-root commit', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'keep.ts'), 'old\n')
    writeFileSync(join(dir, 'gone.ts'), 'bye\n')
    git(dir, 'add keep.ts gone.ts')
    git(dir, 'commit -m root')
    writeFileSync(join(dir, 'keep.ts'), 'new\n')
    writeFileSync(join(dir, 'extra.ts'), 'added\n')
    git(dir, 'rm gone.ts')
    git(dir, 'add keep.ts extra.ts')
    git(dir, 'commit -m change')
    const hash = git(dir, 'rev-parse HEAD')
    const result = await readGitCommitDiff(dir, hash.slice(0, 8), new AbortController().signal)
    expect(result.availability).toBe('repository')
    if (result.availability !== 'repository') return
    expect(result.hash).toBe(hash)
    expect(result.truncated).toBe(false)
    expect(result.files.map(file => [file.path, file.status, file.preview.kind])).toEqual([
      ['extra.ts', 'added', 'untracked-text'],
      ['gone.ts', 'deleted', 'deleted-text'],
      ['keep.ts', 'modified', 'text'],
    ])
    const extra = result.files.find(file => file.path === 'extra.ts')?.preview
    expect(extra).toMatchObject({ kind: 'untracked-text', text: 'added\n' })
    const gone = result.files.find(file => file.path === 'gone.ts')?.preview
    expect(gone).toMatchObject({ kind: 'deleted-text', text: 'bye\n' })
    const keep = result.files.find(file => file.path === 'keep.ts')?.preview
    expect(keep?.kind).toBe('text')
    if (keep?.kind !== 'text') return
    expect(keep.fileText).toBe('new\n')
    expect(keep.hunks.some(hunk => hunk.lines.some(line => line.origin === 'add' && line.text === 'new'))).toBe(true)
  })

  it('treats a root commit as added files against the empty tree', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'readme.md'), 'hello\n')
    git(dir, 'add readme.md')
    git(dir, 'commit -m root')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal)
    expect(result).toMatchObject({
      availability: 'repository',
      truncated: false,
      files: [{ path: 'readme.md', status: 'added', preview: { kind: 'untracked-text', text: 'hello\n' } }],
    })
  })

  it('returns an empty file list for an empty commit', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'a.ts'), 'a\n')
    git(dir, 'add a.ts')
    git(dir, 'commit -m root')
    git(dir, 'commit --allow-empty -m empty')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal)
    expect(result).toMatchObject({ availability: 'repository', files: [], truncated: false })
  })

  it('diffs a merge against the first parent only', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'base.ts'), 'base\n')
    git(dir, 'add base.ts')
    git(dir, 'commit -m root')
    git(dir, 'checkout -b side')
    writeFileSync(join(dir, 'side.ts'), 'from-side\n')
    git(dir, 'add side.ts')
    git(dir, 'commit -m side')
    git(dir, 'checkout main')
    git(dir, 'merge --no-ff side -m merge')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal)
    expect(result.availability).toBe('repository')
    if (result.availability !== 'repository') return
    expect(result.files).toEqual([
      { path: 'side.ts', status: 'added', preview: { kind: 'untracked-text', text: 'from-side\n' } },
    ])
  })

  it('reports a rename as renamed with the new path text', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'old.ts'), 'same\n')
    git(dir, 'add old.ts')
    git(dir, 'commit -m root')
    git(dir, 'mv old.ts new.ts')
    git(dir, 'commit -m rename')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal)
    expect(result.availability).toBe('repository')
    if (result.availability !== 'repository') return
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({ path: 'new.ts', status: 'renamed' })
    expect(result.files[0]?.preview.kind).toBe('text')
  })

  it('marks added and deleted binaries without dumping blobs', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'keep.bin'), Buffer.from([0, 1, 2]))
    git(dir, 'add keep.bin')
    git(dir, 'commit -m root')
    git(dir, 'rm keep.bin')
    writeFileSync(join(dir, 'fresh.bin'), Buffer.from([0, 9, 9]))
    git(dir, 'add fresh.bin')
    git(dir, 'commit -m bins')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal)
    expect(result.availability).toBe('repository')
    if (result.availability !== 'repository') return
    expect(result.files).toEqual(expect.arrayContaining([
      { path: 'fresh.bin', status: 'added', preview: { kind: 'binary' } },
      { path: 'keep.bin', status: 'deleted', preview: { kind: 'deleted-binary' } },
    ]))
  })

  it('marks a modified binary without text hunks', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'blob.bin'), Buffer.from([0, 1]))
    git(dir, 'add blob.bin')
    git(dir, 'commit -m root')
    writeFileSync(join(dir, 'blob.bin'), Buffer.from([0, 2]))
    git(dir, 'add blob.bin')
    git(dir, 'commit -m change')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal)
    expect(result).toMatchObject({
      availability: 'repository',
      files: [{ path: 'blob.bin', status: 'modified', preview: { kind: 'binary' } }],
    })
  })

  it('omits .DS_Store from the file list', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'keep.ts'), 'a\n')
    git(dir, 'add keep.ts')
    git(dir, 'commit -m root')
    writeFileSync(join(dir, '.DS_Store'), 'junk')
    writeFileSync(join(dir, 'keep.ts'), 'b\n')
    git(dir, 'add .DS_Store keep.ts')
    git(dir, 'commit -m hide')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal)
    expect(result.availability).toBe('repository')
    if (result.availability !== 'repository') return
    expect(result.files.map(file => file.path)).toEqual(['keep.ts'])
  })

  it('caps the file list and sets truncated', async () => {
    const dir = tempRepo()
    mkdirSync(join(dir, 'many'))
    writeFileSync(join(dir, 'many/a.ts'), 'a\n')
    writeFileSync(join(dir, 'many/b.ts'), 'b\n')
    git(dir, 'add many')
    git(dir, 'commit -m two')
    const result = await readGitCommitDiff(dir, 'HEAD', new AbortController().signal, undefined, 1)
    expect(result.availability).toBe('repository')
    if (result.availability !== 'repository') return
    expect(result.files).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })

  it('builds a tracked-text preview for a root commit name-status modify (empty tree)', async () => {
    const root = realpathSync.native(tmpdir())
    const run: NativeCommandRunner = async (_command, args) => {
      if (args.includes('--show-toplevel')) return { stdout: `${root}\n`, stderr: '' }
      if (args.includes('--verify')) return { stdout: `${'a'.repeat(40)}\n`, stderr: '' }
      if (args.includes('--parents')) return { stdout: `${'a'.repeat(40)}\n`, stderr: '' }
      if (args.includes('--name-status')) return { stdout: ['M', 'keep.ts', ''].join('\0'), stderr: '' }
      if (args.includes('--numstat')) return { stdout: '1\t1\tkeep.ts\n', stderr: '' }
      if (args.includes('-p')) return { stdout: '@@ -1 +1 @@\n-old\n+new\n', stderr: '' }
      if (args.includes('show')) return { stdout: 'new\n', stderr: '' }
      return { stdout: '', stderr: '' }
    }
    const result = await readGitCommitDiff(root, 'aaaaaaaa', new AbortController().signal, run)
    expect(result.availability).toBe('repository')
    if (result.availability !== 'repository') return
    expect(result.files).toHaveLength(1)
    expect(result.files[0]?.status).toBe('modified')
    expect(result.files[0]?.preview.kind).toBe('text')
  })

  it('fails an unknown hash with git-failed', async () => {
    const dir = tempRepo()
    writeFileSync(join(dir, 'a.ts'), 'a\n')
    git(dir, 'add a.ts')
    git(dir, 'commit -m root')
    await expect(readGitCommitDiff(dir, 'deadbeef', new AbortController().signal))
      .rejects.toMatchObject({ name: 'GitCommandFailedError' })
  })
})
