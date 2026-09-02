/**
 * Keyless real-server e2e: pyright editor diagnostics through ctx.lspEditor after a blank-line edit.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import Lsp from '@deepseek-ai/dsh-lsp'
import LspEditor from '@deepseek-ai/dsh-lsp-editor'
import * as LspLocal from '@deepseek-ai/dsh-lsp-stdio'

const BASE = [
  'def bubble_sort(arr):',
  '    n = len(arr)',
  '    for i in range(n):',
  '        for j in range(0, n - i - 1):',
  '            if arr[j] > arr[j + 1]:',
  '                arr[j], arr[j + 1] = arr[j + 1], arr[j]',
  '    return arr',
  '',
  'def _run_tests():',
  '    assert bubble_sort([3, 1, 2]) == [1, 2, 3]',
  '    assert bubble_sort([]) == []',
  '    print("所有测试通过 ✓")',
  '',
  'if __name__ == "__main__":',
  '    _run_tests()',
  '',
].join('\n')

const WITH_BLANK = BASE.replace(
  '    print("所有测试通过 ✓")\n\nif __name__',
  '    print("所有测试通过 ✓")\n\n\nif __name__',
)

let root: string
let ws: string
let ctx: Context

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lsp-py-e2e-')))
  ws = join(root, 'code')
  await mkdir(ws)
  await writeFile(join(ws, 'bubble_sort.py'), BASE)

  ctx = new Context()
  await ctx.plugin(Lsp)
  await ctx.plugin(LspEditor)
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: process.cwd() })
  await ctx.plugin(LspLocal, {
    servers: {
      python: {
        command: 'uvx',
        args: ['--from', 'pyright', 'pyright-langserver', '--stdio'],
        extensionToLanguage: { '.py': 'python' },
      },
    },
  })
}, 120_000)

afterAll(async () => {
  if (ctx) await ctx.fiber.dispose()
  if (root) await rm(root, { recursive: true, force: true })
})

describe('real pyright editor sync', () => {
  it('returns no errors after inserting a blank line before __main__', async () => {
    const path = join(ws, 'bubble_sort.py')
    await ctx.lspEditor.syncDocument({
      workspaceRoot: ws,
      filePath: path,
      text: BASE,
      version: 1,
    })
    const diagnostics = await ctx.lspEditor.syncDocument({
      workspaceRoot: ws,
      filePath: path,
      text: WITH_BLANK,
      version: 2,
    })
    const errors = diagnostics.filter(item => item.severity === 'error')
    expect(errors).toEqual([])
  }, 120_000)
})
