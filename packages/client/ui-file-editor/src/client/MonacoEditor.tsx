/** Monaco (or textarea fallback) for an editable-text tab. */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { HostLspDiagnostic, HostLspHover } from '@deepseek-ai/dsh-client-runtime/client'
import { loadMonacoEditor, type MonacoEditorModule, type MonacoStandaloneEditor } from './monaco-load.ts'
import { ensureMonacoConfigured } from './monaco-config.ts'
import { monacoOptionsForContent } from './editor-file-policy.ts'
import { setLspHoverHandler } from './monaco-hover.ts'
import { installMonacoEnvironment } from './monaco-environment.ts'
import css from './MonacoEditor.module.css'

/** Props for the editable-text editor widget. */
export interface MonacoEditorProps {
  /** Host-absolute path; changing it remounts the model. */
  path: string
  /** Current edit-buffer text. */
  value: string
  /** Monaco language id. */
  language: string
  /** Language-server diagnostics for the current buffer. */
  diagnostics?: readonly HostLspDiagnostic[] | undefined
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
  /**
   * Language-server hover at a zero-based UTF-16 cursor position.
   * @param line - zero-based line.
   * @param character - zero-based character.
   * @param signal - aborts a superseded hover request.
   */
  onHover?: (line: number, character: number, signal?: AbortSignal) => Promise<HostLspHover | null>
}

/**
 * Built-in Monaco theme id; background is applied through CSS so token colors
 * stay on the default vs / vs-dark palette.
 * @param dark - whether `body[data-ds-dark-theme]` is set.
 * @returns Monaco theme id.
 */
function themeIdFor(dark: boolean): string {
  return dark ? 'vs-dark' : 'vs'
}

function markerSeverity(
  monaco: MonacoEditorModule,
  severity: HostLspDiagnostic['severity'],
): number {
  switch (severity) {
    case 'error': return monaco.MarkerSeverity.Error
    case 'warning': return monaco.MarkerSeverity.Warning
    case 'info': return monaco.MarkerSeverity.Info
    default: return monaco.MarkerSeverity.Hint
  }
}

type EditorHandle = {
  setValue: (next: string) => void
  dispose: () => void
  setDiagnostics: (items: readonly HostLspDiagnostic[] | undefined) => void
}

/**
 * Editable-text widget: Monaco when it can start, a code-font textarea otherwise
 * (jsdom and worker-less bundles). The accessible name carries language and theme.
 * @param props - buffer, language, theme, and change callback.
 */
export function MonacoEditor({
  path, value, language, diagnostics, ariaLabel, dark, surface = 'sidebar', onChange, onHover,
}: MonacoEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const monacoRef = useRef<MonacoEditorModule | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onHoverRef = useRef(onHover)
  const [fallback, setFallback] = useState(true)
  valueRef.current = value
  onChangeRef.current = onChange
  onHoverRef.current = onHover

  useEffect(() => {
    setLspHoverHandler(onHover)
    return () => {
      if (onHoverRef.current === onHover) setLspHoverHandler(undefined)
    }
  }, [onHover])

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
      installMonacoEnvironment()
      ensureMonacoConfigured(monaco)
      const theme = themeIdFor(dark)
      monacoRef.current = monaco
      const contentOptions = monacoOptionsForContent(valueRef.current)
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
          wordWrap: contentOptions.wordWrap,
          wrappingStrategy: contentOptions.wrappingStrategy,
          largeFileOptimizations: contentOptions.largeFileOptimizations,
          scrollbar: { horizontal: 'auto', vertical: 'auto' },
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          fixedOverflowWidgets: true,
          links: false,
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          hover: { enabled: true, above: true },
          unicodeHighlight: {
            invisibleCharacters: false,
            ambiguousCharacters: false,
            nonBasicASCII: false,
          },
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
        setDiagnostics: (items) => {
          const currentModel = editor.getModel()
          if (currentModel === null) return
          const markers = (items ?? []).map(item => ({
            severity: markerSeverity(monaco, item.severity),
            message: item.message,
            startLineNumber: item.range.start.line + 1,
            startColumn: item.range.start.character + 1,
            endLineNumber: item.range.end.line + 1,
            endColumn: item.range.end.character + 1,
          }))
          monaco.editor.setModelMarkers(currentModel, 'dsh-lsp', markers)
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
    const handle = editorRef.current
    if (handle === null) return
    const id = window.requestAnimationFrame(() => {
      handle.setValue(value)
    })
    return () => { window.cancelAnimationFrame(id) }
  }, [value])

  useEffect(() => {
    editorRef.current?.setDiagnostics(diagnostics)
  }, [diagnostics])

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
