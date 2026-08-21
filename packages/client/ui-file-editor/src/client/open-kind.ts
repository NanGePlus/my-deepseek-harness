/** Classify a Workspace path into the three open modes and a Monaco language. */

/** How a file click is handled: load text, load preview bytes, or show a hint without I/O. */
export type OpenKind = 'text' | 'preview' | 'non-openable'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

const BINARY_EXT = new Set([
  '.wasm', '.exe', '.dll', '.so', '.dylib', '.o', '.a', '.bin', '.dat',
  '.zip', '.gz', '.tgz', '.tar', '.7z', '.rar', '.bz2', '.xz',
  '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.ico',
  '.mp3', '.mp4', '.webm', '.wav', '.ogg', '.mov', '.avi',
  '.class', '.jar', '.pyc', '.pyo',
])

const LANGUAGE_BY_EXT: Readonly<Record<string, string>> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.svg': 'xml',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'ini',
  '.ini': 'ini',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.sql': 'sql',
  '.lua': 'lua',
  '.r': 'r',
  '.dockerfile': 'dockerfile',
}

const LANGUAGE_LABEL: Readonly<Record<string, string>> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  json: 'JSON',
  markdown: 'Markdown',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  html: 'HTML',
  xml: 'XML',
  yaml: 'YAML',
  ini: 'INI',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  kotlin: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  ruby: 'Ruby',
  php: 'PHP',
  shell: 'Shell',
  sql: 'SQL',
  lua: 'Lua',
  r: 'R',
  dockerfile: 'dockerfile',
  plaintext: 'Plain Text',
}

/** Monaco language ids that receive the host LSP hover provider. */
export const MONACO_HOVER_LANGUAGE_IDS: readonly string[] = [
  ...new Set([...Object.values(LANGUAGE_BY_EXT), 'plaintext']),
]

/**
 * Last path segment of an absolute Host path.
 * @param path - Host-absolute file path.
 * @returns the file name, or the original path when it has no separator.
 */
export function fileNameOf(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

/**
 * Lowercased extension including the leading dot.
 * @param path - Host-absolute file path.
 * @returns `''` when the name has no extension.
 */
export function extnameOf(path: string): string {
  const name = fileNameOf(path)
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * Decide the open mode from the path. Image extensions preview; known binary
 * extensions are non-openable and must not be read; everything else is text.
 * @param path - Host-absolute file path.
 * @returns the open mode used by the editor pane.
 */
export function openKindForPath(path: string): OpenKind {
  const ext = extnameOf(path)
  if (IMAGE_EXT.has(ext)) return 'preview'
  if (BINARY_EXT.has(ext)) return 'non-openable'
  return 'text'
}

/**
 * Monaco language id for a text file path.
 * @param path - Host-absolute file path.
 * @returns a Monaco language id (`plaintext` when unknown).
 */
export function languageForPath(path: string): string {
  const name = fileNameOf(path).toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'plaintext'
  return LANGUAGE_BY_EXT[extnameOf(path)] ?? 'plaintext'
}

/**
 * Human-readable language label for the editor's accessible name.
 * @param language - Monaco language id from {@link languageForPath}.
 * @returns the visible language name.
 */
export function languageLabel(language: string): string {
  return LANGUAGE_LABEL[language] ?? language
}

/**
 * Whether a text tab uses the Markdown preview/source switcher.
 * @param language - Monaco language id from {@link languageForPath}.
 * @returns true for Markdown sources.
 */
export function isMarkdownLanguage(language: string): boolean {
  return language === 'markdown'
}

/**
 * Path segments shown in the Markdown editor breadcrumb.
 * @param workspaceRoot - bound Workspace root, if any.
 * @param filePath - Host-absolute file path.
 * @returns segments relative to the workspace root, or the file name alone.
 */
export function breadcrumbSegments(workspaceRoot: string | undefined, filePath: string): readonly string[] {
  if (workspaceRoot === undefined) return [fileNameOf(filePath)]
  const normalizedRoot = workspaceRoot.replace(/[/\\]+$/, '')
  if (filePath === normalizedRoot) return [fileNameOf(filePath)]
  const prefix = `${normalizedRoot}/`
  if (!filePath.startsWith(prefix)) return [fileNameOf(filePath)]
  const parts = filePath.slice(prefix.length).split(/[/\\]/).filter(part => part !== '')
  return parts.length > 0 ? parts : [fileNameOf(filePath)]
}
