import { describe, expect, it } from 'vitest'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import {
  parseGitLogOutput, parseGitLogRefs, gitLogPagingArgs, sliceGitLogPage, readGitLog,
} from '../src/git-log.ts'
import type { GitLogEntry } from '../src/api/host.ts'

describe('parseGitLogRefs', () => {
  it('keeps origin/ remote labels distinct from the local branch', () => {
    expect(parseGitLogRefs('HEAD -> main, origin/main, origin/HEAD, tag: v1.0')).toEqual(['main', 'origin/main', 'v1.0'])
  })

  it('skips empty decoration parts, duplicate labels, and a bare HEAD', () => {
    expect(parseGitLogRefs('HEAD, , main, main')).toEqual(['main'])
  })
})

describe('parseGitLogOutput', () => {
  it('parses field-separated git log records', () => {
    const stdout = [
      ['aaa'.repeat(10), 'aaaabbbb', 'bbb'.repeat(10), 'first commit', 'Alice', '2026-08-27T02:06:00+00:00', 'HEAD -> main', '- body'].join('\x1f'),
      ['ccc'.repeat(10), 'ccccdddd', '', 'root commit', 'Bob', '2026-08-26T00:00:00+00:00', '', ''].join('\x1f'),
    ].join('\x1e')
    const commits = parseGitLogOutput(stdout)
    expect(commits).toHaveLength(2)
    expect(commits[0]).toMatchObject({
      hash: 'aaa'.repeat(10),
      shortHash: 'aaaabbbb',
      parents: ['bbb'.repeat(10)],
      subject: 'first commit',
      authorName: 'Alice',
      authorDate: '2026-08-27T02:06:00+00:00',
      body: '- body',
      refs: ['main'],
    })
    expect(commits[1]?.parents).toEqual([])
  })

  it('skips a record whose hash field is empty', () => {
    const stdout = ['', 'short', '', 'no-hash', 'Ada', '2026-08-27T00:00:00+00:00', '', ''].join('\x1f')
    expect(parseGitLogOutput(stdout)).toEqual([])
  })

  it('keeps newlines inside the commit body field', () => {
    const body = '- first\n\n- second'
    const stdout = [
      'h'.repeat(40), 'hhhhhhhh', '', 'subject', 'Ada', '2026-08-27T02:06:00+00:00', 'HEAD -> main', body,
    ].join('\x1f') + '\x1e'
    expect(parseGitLogOutput(stdout)[0]).toMatchObject({ subject: 'subject', body, refs: ['main'] })
  })

  it('strips the newline git inserts after each format record so parent hashes match', () => {
    const stdout = [
      ['c3'.repeat(10), 'c3short', 'c2'.repeat(10), 'tip', 'Ada', '2026-08-27T02:06:00+00:00', 'HEAD -> main', ''].join('\x1f'),
      ['c2'.repeat(10), 'c2short', 'c1'.repeat(10), 'mid', 'Ada', '2026-08-27T01:00:00+00:00', '', ''].join('\x1f'),
      ['c1'.repeat(10), 'c1short', '', 'root', 'Ada', '2026-08-27T00:00:00+00:00', '', ''].join('\x1f'),
    ].join('\x1e\n') + '\x1e\n'
    const commits = parseGitLogOutput(stdout)
    expect(commits).toHaveLength(3)
    expect(commits[0]?.hash.startsWith('\n')).toBe(false)
    expect(commits[1]?.hash).toBe('c2'.repeat(10))
    expect(commits[0]?.parents).toEqual([commits[1]?.hash])
    expect(commits[1]?.parents).toEqual([commits[2]?.hash])
  })
})

describe('gitLogPagingArgs', () => {
  it('probes one extra commit and omits skip on the first page', () => {
    expect(gitLogPagingArgs(50, 0)).toEqual(['--max-count=51'])
  })

  it('adds --skip after the first page', () => {
    expect(gitLogPagingArgs(50, 50)).toEqual(['--max-count=51', '--skip=50'])
  })
})

describe('sliceGitLogPage', () => {
  const row = (hash: string): GitLogEntry => ({
    hash, shortHash: hash.slice(0, 8), parents: [], subject: hash, authorName: 'Ada',
    authorDate: '2026-08-27T00:00:00+00:00', body: '', refs: [],
  })

  it('sets hasMore when the probe row is present', () => {
    const fetched = [row('a'.repeat(40)), row('b'.repeat(40)), row('c'.repeat(40))]
    expect(sliceGitLogPage(fetched, 2)).toEqual({
      commits: fetched.slice(0, 2),
      hasMore: true,
    })
  })

  it('clears hasMore when the page is short', () => {
    const fetched = [row('a'.repeat(40))]
    expect(sliceGitLogPage(fetched, 50)).toEqual({ commits: fetched, hasMore: false })
  })
})

describe('readGitLog', () => {
  const root = realpathSync.native(tmpdir())

  it('returns not-a-repository or git-unavailable for a non-repo directory', async () => {
    const result = await readGitLog(root, new AbortController().signal)
    expect(result.availability === 'not-a-repository' || result.availability === 'git-unavailable').toBe(true)
  })

  it('pages with skip, probes hasMore, and keeps repoRoot canonical', async () => {
    const records = [
      ['a'.repeat(40), 'aaaa', 'b'.repeat(40), 'newest', 'Ada', '2026-08-27T02:00:00+00:00', '', ''].join('\x1f'),
      ['b'.repeat(40), 'bbbb', 'c'.repeat(40), 'middle', 'Ada', '2026-08-27T01:00:00+00:00', '', ''].join('\x1f'),
      ['c'.repeat(40), 'cccc', '', 'oldest', 'Ada', '2026-08-27T00:00:00+00:00', '', ''].join('\x1f'),
    ].join('\x1e')
    const run: NativeCommandRunner = async (_command, args) => {
      if (args.includes('rev-parse')) return { stdout: `${root}\n`, stderr: '' }
      expect(args).toContain('--max-count=3')
      expect(args).toContain('--skip=50')
      return { stdout: records, stderr: '' }
    }
    const result = await readGitLog(root, new AbortController().signal, 2, 50, run)
    expect(result).toMatchObject({
      availability: 'repository',
      repoRoot: root,
      hasMore: true,
    })
    if (result.availability === 'repository') {
      expect(result.commits.map(entry => entry.subject)).toEqual(['newest', 'middle'])
    }
  })

  it('omits --skip on the first page and reports hasMore false for a short page', async () => {
    const run: NativeCommandRunner = async (_command, args) => {
      if (args.includes('rev-parse')) return { stdout: `${root}\n`, stderr: '' }
      expect(args.some(arg => arg.startsWith('--skip='))).toBe(false)
      expect(args).toContain('--max-count=51')
      return { stdout: '', stderr: '' }
    }
    await expect(readGitLog(root, new AbortController().signal, 50, 0, run)).resolves.toMatchObject({
      availability: 'repository',
      repoRoot: root,
      commits: [],
      hasMore: false,
    })
  })

  it('maps a non-repository stderr to not-a-repository', async () => {
    const run: NativeCommandRunner = async () => {
      throw Object.assign(new Error('fatal: not a git repository'), {
        stderr: 'fatal: not a git repository (or any of the parent directories): .git',
      })
    }
    await expect(readGitLog(root, new AbortController().signal, 50, 0, run))
      .resolves.toEqual({ availability: 'not-a-repository' })
  })

  it('maps missing git to git-unavailable', async () => {
    const run: NativeCommandRunner = async () => {
      throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
    }
    await expect(readGitLog(root, new AbortController().signal, 50, 0, run))
      .resolves.toEqual({ availability: 'git-unavailable' })
  })

  it('rethrows when the caller aborts', async () => {
    const ac = new AbortController()
    ac.abort()
    const run: NativeCommandRunner = async () => {
      throw new Error('killed')
    }
    await expect(readGitLog(root, ac.signal, 50, 0, run)).rejects.toThrow('killed')
  })

  it('rethrows unexpected git failures', async () => {
    const run: NativeCommandRunner = async () => {
      throw new Error('corrupt object')
    }
    await expect(readGitLog(root, new AbortController().signal, 50, 0, run)).rejects.toThrow('corrupt object')
  })
})
