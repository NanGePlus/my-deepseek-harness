/** Monaco (or textarea fallback) for an editable-text tab. */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { loadMonacoEditor, type MonacoEditorModule, type MonacoStandaloneEditor } from './monaco-load.ts'
import css from './MonacoEditor.module.css'

/** Props for the editable-text editor widget. */
export interface MonacoEditorProps {
  /** Host-absolute path; changing it remounts the model. */
  path: string
  /** Current edit-buffer text. */
  value: string
  /** Monaco language id. */
  language: string
  /** Accessible name (file, language, theme). */
  ariaLabel: string
  /** Harness theme: dark when `body[data-ds-dark-theme]` is set. */
  dark: boolean
  /**
   * Editor canvas background token family.
   * `document` uses bg-base (white in light mode) for Markdown source editing.
   */
  surface?: 'sidebar' | 'document' | undefined
  /**
   * Buffer change from the user.
   * @param value - the new buffer text.
   */
  onChange: (value: string) => void
}

const definedThemes = new Set<string>()

/**
 * Derive Monaco themes from live `--dsw-alias-*` values so light/dark follow
 * the Harness document theme without a second palette.
 * @param monaco - loaded monaco-editor module.
 * @param dark - whether `body[data-ds-dark-theme]` is set.
 * @param surface - sidebar chrome vs document (Markdown) canvas.
 * @returns the theme id to pass to `create`.
 */
function themeIdFor(
  monaco: MonacoEditorModule,
  dark: boolean,
  surface: 'sidebar' | 'document',
): string {
  const suffix = surface === 'document' ? '-document' : ''
  const custom = dark ? `dsh-dark${suffix}` : `dsh-light${suffix}`
  const builtin = dark ? 'vs-dark' : 'vs'
  if (definedThemes.has(custom)) return custom
  const styles = getComputedStyle(document.body)
  const bgToken = surface === 'document' ? '--dsw-alias-bg-base' : '--dsw-specific-sidebar-fill'
  const bg = styles.getPropertyValue(bgToken).trim()
  const fg = styles.getPropertyValue('--dsw-alias-label-primary').trim()
  if (bg !== '' && fg !== '') {
    monaco.editor.defineTheme(`dsh-light${suffix}`, {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: { 'editor.background': bg, 'editor.foreground': fg },
    })
    monaco.editor.defineTheme(`dsh-dark${suffix}`, {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: { 'editor.background': bg, 'editor.foreground': fg },
    })
    definedThemes.add('dsh-light')
    definedThemes.add('dsh-dark')
    definedThemes.add('dsh-light-document')
    definedThemes.add('dsh-dark-document')
    return custom
  }
  return builtin
}

/**
 * Editable-text widget: Monaco when it can start, a code-font textarea otherwise
 * (jsdom and worker-less bundles). The accessible name carries language and theme.
 * @param props - buffer, language, theme, and change callback.
 */
export function MonacoEditor({
  path, value, language, ariaLabel, dark, surface = 'sidebar', onChange,
}: MonacoEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<{ setValue: (next: string) => void; dispose: () => void } | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [fallback, setFallback] = useState(true)
  valueRef.current = value
  onChangeRef.current = onChange

  useEffect(() => {
    const host = hostRef.current
    /* v8 ignore next -- the host div is committed before this effect */
    if (host === null) return
    let cancelled = false
    void loadMonacoEditor().then((monaco) => {
      if (cancelled) return
      if (monaco === undefined) return
      /* v8 ignore next -- cleanup sets cancelled before the host unmounts */
      if (hostRef.current === null) return
      const global = globalThis as typeof globalThis & {
        MonacoEnvironment?: { getWorker: () => Worker }
      }
      global.MonacoEnvironment ??= {
        getWorker: () => {
          /* v8 ignore next -- monaco calls this from editor.create in a browser */
          return new Worker('data:text/javascript,onmessage=function(){}')
        },
      }
      const theme = themeIdFor(monaco, dark, surface)
      const fontFamily = getComputedStyle(document.body)
        .getPropertyValue('--ds-font-family-code')
        .trim() || 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
      let editor: MonacoStandaloneEditor
      try {
        editor = monaco.editor.create(host, {
          value: valueRef.current,
          language,
          theme,
          fontFamily,
          fontSize: 13,
          lineHeight: 20,
          minimap: { enabled: false },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          wrappingStrategy: 'advanced',
          scrollbar: { horizontal: 'auto', vertical: 'auto' },
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
        })
      } catch (error: unknown) {
        // jsdom and worker-less hosts: monaco.editor.create throws; keep textarea.
        void error
        setFallback(true)
        return
      }
      editor.onDidChangeModelContent(() => {
        const next = editor.getValue()
        if (next !== valueRef.current) onChangeRef.current(next)
      })
      editorRef.current = {
        setValue: (next) => {
          if (editor.getValue() !== next) editor.setValue(next)
        },
        dispose: () => { editor.dispose() },
      }
      setFallback(false)
    })
    return () => {
      cancelled = true
      editorRef.current?.dispose()
      editorRef.current = null
      setFallback(true)
    }
  }, [path, language, dark, surface])

  useEffect(() => {
    editorRef.current?.setValue(value)
  }, [value])

  return (
    <div className={clsx(css.wrap, surface === 'document' && css.document)}>
      {fallback && (
        <textarea
          className={clsx(css.fallback, surface === 'document' && css.document)}
          aria-label={ariaLabel}
          value={value}
          spellCheck={false}
          onChange={(event) => { onChange(event.target.value) }}
        />
      )}
      <div
        ref={hostRef}
        className={css.host}
        hidden={fallback}
        role={fallback ? undefined : 'textbox'}
        aria-multiline={fallback ? undefined : true}
        aria-label={fallback ? undefined : ariaLabel}
      />
    </div>
  )
}
