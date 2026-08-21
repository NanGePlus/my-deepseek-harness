/** Copy Monaco minified worker scripts beside lib/client.js for browser Worker URLs. */

import { cp, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(join(packageRoot, 'package.json'))
const monacoRoot = join(dirname(require.resolve('monaco-editor/package.json')), 'min/vs')
const outDir = join(packageRoot, 'lib/monaco')

await mkdir(outDir, { recursive: true })
await cp(join(monacoRoot, 'base/worker/workerMain.js'), join(outDir, 'editor.worker.js'))
await cp(join(monacoRoot, 'language/typescript/tsWorker.js'), join(outDir, 'ts.worker.js'))
await cp(join(monacoRoot, 'language/json/jsonWorker.js'), join(outDir, 'json.worker.js'))
