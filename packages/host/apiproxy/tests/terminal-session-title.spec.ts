import { describe, expect, it } from 'vitest'
import {
  formatForegroundCommandLabel,
  readProcessCwd,
  resolveTerminalSessionTitleParts,
  shortenHomePath,
} from '../src/terminal-session-title.ts'

describe('shortenHomePath', () => {
  it('prefixes home with tilde', () => {
    expect(shortenHomePath('/Users/nange/Desktop/test', '/Users/nange')).toBe('~/Desktop/test')
    expect(shortenHomePath('/Users/nange', '/Users/nange')).toBe('~')
  })
})

describe('formatForegroundCommandLabel', () => {
  it('keeps comm plus trailing args', () => {
    expect(formatForegroundCommandLabel('python', '/usr/bin/python py_env.py')).toBe('python py_env.py')
    expect(formatForegroundCommandLabel('node', 'node -e "setInterval(()=>{}, 10000)"')).toBe('node -e "setInterval(()=>{}, 10000)"')
  })
})

describe('readProcessCwd', () => {
  it('parses lsof cwd output on darwin', () => {
    const cwd = readProcessCwd(42, () => 'p42\nfcwd\nn/tmp/demo\n', 'darwin')
    expect(cwd).toBe('/tmp/demo')
  })

  it('reads /proc cwd on linux', () => {
    const cwd = readProcessCwd(42, () => '/tmp/demo', 'linux')
    expect(cwd).toBe('/tmp/demo')
  })
})

describe('resolveTerminalSessionTitleParts', () => {
  it('formats idle shell titles with cwd and profile name', () => {
    const parts = resolveTerminalSessionTitleParts(100, '/Users/nange/project', 'zsh', {
      homeDir: '/Users/nange',
      platform: 'darwin',
      exec: (file, args) => {
        if (file === 'ps' && args[0] === '-g') return '200\n'
        if (file === 'ps' && args.includes('comm=')) return 'zsh'
        if (file === 'ps' && args.includes('args=')) return '-zsh'
        if (file === 'lsof') return 'n/Users/nange/project\n'
        throw new Error(`unexpected exec ${file} ${args.join(' ')}`)
      },
    })
    expect(parts).toEqual({
      title: '~/project — zsh',
      titlePath: '~/project',
      titleCommand: 'zsh',
      cwd: '/Users/nange/project',
    })
  })

  it('prefers foreground command labels over the shell profile', () => {
    const parts = resolveTerminalSessionTitleParts(100, '/Users/nange/project', 'zsh', {
      homeDir: '/Users/nange',
      platform: 'darwin',
      exec: (file, args) => {
        if (file === 'ps' && args[0] === '-g') return '200\n201\n'
        if (file === 'ps' && args.includes('-p') && args.includes('comm=')) {
          return args[1] === '200' ? 'zsh' : 'python'
        }
        if (file === 'ps' && args.includes('-p') && args.includes('args=')) {
          return args[1] === '200' ? '-zsh' : 'python py_env.py'
        }
        if (file === 'lsof') return 'n/Users/nange/project\n'
        throw new Error(`unexpected exec ${file} ${args.join(' ')}`)
      },
    })
    expect(parts).toEqual({
      title: '~/project — python py_env.py',
      titlePath: '~/project',
      titleCommand: 'python py_env.py',
      cwd: '/Users/nange/project',
    })
  })
})
