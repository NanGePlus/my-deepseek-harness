import { describe, expect, it } from 'vitest'
import { isMonacoWorkerFile } from '../src/client/monaco-environment.ts'

describe('isMonacoWorkerFile', () => {
  it('accepts the bundled worker filenames only', () => {
    expect(isMonacoWorkerFile('ts.worker.js')).toBe(true)
    expect(isMonacoWorkerFile('json.worker.js')).toBe(true)
    expect(isMonacoWorkerFile('editor.worker.js')).toBe(true)
    expect(isMonacoWorkerFile('../ts.worker.js')).toBe(false)
    expect(isMonacoWorkerFile('client.js')).toBe(false)
  })
})
