/** Browser Worker bootstrap for monaco-editor language tokenization. */

const PLUGIN_ID = '@deepseek-ai/dsh-client-ui-file-editor'

const MONACO_WORKERS = new Set([
  'editor.worker.js',
  'ts.worker.js',
  'json.worker.js',
])

/** Worker file names exposed under `/plugins/<id>/monaco/`. */
export function isMonacoWorkerFile(name: string): boolean {
  return MONACO_WORKERS.has(name)
}

/**
 * Install Monaco web workers served from this plugin bundle directory.
 * Overrides any placeholder worker factory so tokenization can start.
 */
export function installMonacoEnvironment(): void {
  const global = globalThis as typeof globalThis & {
    MonacoEnvironment?: { getWorker?: (moduleId: string, label: string) => Worker }
  }
  global.MonacoEnvironment = {
    ...global.MonacoEnvironment,
    getWorker(_moduleId, label) {
      const base = `/plugins/${PLUGIN_ID}/monaco`
      if (label === 'json') return new Worker(`${base}/json.worker.js`)
      if (label === 'typescript' || label === 'javascript') return new Worker(`${base}/ts.worker.js`)
      return new Worker(`${base}/editor.worker.js`)
    },
  }
}
