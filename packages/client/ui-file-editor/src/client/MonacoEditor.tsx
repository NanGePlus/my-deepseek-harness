/** Monaco (or textarea fallback) for an editable-text tab. */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { HostLspDiagnostic, HostLspHover } from '@deepseek-ai/dsh-client-runtime/client'
import { loadMonacoEditor, type MonacoEditorModule, type MonacoStandaloneEditor } from './monaco-load.ts'
import { ensureMonacoConfigured } from './monaco-config.ts'
import { monacoOptionsForContent, monacoSurfaceOptionsForLanguage } from './editor-file-policy.ts'
import { emitMonacoBuffer, shouldSyncMonacoBuffer } from './monaco-buffer-sync.ts'
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

type SyncState = {
  composing: boolean
  focused: boolean
}

/**
 * Attach IME and focus listeners so buffer sync can skip live composition sessions.
 * @param root - Monaco host element or fallback textarea.
 * @param syncState - Mutable focus / composition flags.
 * @param flush - Commits the current buffer upstream after composition ends.
 */
export function installMonacoImeGuards(
  root: HTMLElement,
  syncState: SyncState,
  flush: () => void,
): () => void {
  const onFocusIn = (): void => { syncState.focused = true }
  const onFocusOut = (): void => { syncState.focused = false }
  const onCompositionStart = (): void => { syncState.composing = true }
  const onCompositionEnd = (): void => {
    syncState.composing = false
    flush()
  }
  root.addEventListener('focusin', onFocusIn)
  root.addEventListener('focusout', onFocusOut)
  root.addEventListener('compositionstart', onCompositionStart)
  root.addEventListener('compositionend', onCompositionEnd)
  return () => {
    root.removeEventListener('focusin', onFocusIn)
    root.removeEventListener('focusout', onFocusOut)
    root.removeEventListener('compositionstart', onCompositionStart)
    root.removeEventListener('compositionend', onCompositionEnd)
  }
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
  const fallbackRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const monacoRef = useRef<MonacoEditorModule | null>(null)
  const valueRef = useRef(value)
  const lastEmitted = useRef(value)
  const syncState = useRef<SyncState>({ composing: false, focused: false })
  const onChangeRef = useRef(onChange)
  const onHoverRef = useRef(onHover)
  const [fallback, setFallback] = useState(true)
  valueRef.current = value
  onChangeRef.current = onChange
  onHoverRef.current = onHover

  useEffect(() => {
    lastEmitted.current = value
  }, [path])

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
    let removeImeGuards: (() => void) | undefined
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
      const surfaceOptions = monacoSurfaceOptionsForLanguage(language, contentOptions)
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
          wordWrap: surfaceOptions.wordWrap,
          wrappingStrategy: surfaceOptions.wrappingStrategy,
          accessibilitySupport: surfaceOptions.accessibilitySupport,
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
      lastEmitted.current = editor.getValue()
      const flushBuffer = (): void => {
        const next = editor.getValue()
        if (next === lastEmitted.current) return
        emitMonacoBuffer(next, onChangeRef.current, lastEmitted)
      }
      removeImeGuards = installMonacoImeGuards(host, syncState.current, flushBuffer)
      editor.onDidChangeModelContent(() => {
        if (syncState.current.composing) return
        flushBuffer()
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
      removeImeGuards?.()
      editorRef.current?.dispose()
      editorRef.current = null
      syncState.current = { composing: false, focused: false }
      setFallback(true)
    }
  }, [path, language, dark, surface])

  useEffect(() => {
    const handle = editorRef.current
    if (handle === null) return
    if (!shouldSyncMonacoBuffer(value, lastEmitted.current, syncState.current)) return
    const id = window.requestAnimationFrame(() => {
      handle.setValue(value)
      lastEmitted.current = value
    })
    return () => { window.cancelAnimationFrame(id) }
  }, [value])

  useEffect(() => {
    if (!fallback) return
    const textarea = fallbackRef.current
    if (textarea === null) return
    if (!shouldSyncMonacoBuffer(value, lastEmitted.current, syncState.current)) return
    if (textarea.value !== value) textarea.value = value
    lastEmitted.current = value
  }, [value, fallback])

  useEffect(() => {
    if (!fallback) return
    const textarea = fallbackRef.current
    if (textarea === null) return
    const flush = (): void => {
      if (textarea.value === lastEmitted.current) return
      emitMonacoBuffer(textarea.value, onChangeRef.current, lastEmitted)
    }
    return installMonacoImeGuards(textarea, syncState.current, flush)
  }, [fallback, path])

  useEffect(() => {
    editorRef.current?.setDiagnostics(diagnostics)
  }, [diagnostics])

  return (
    <div className={clsx(css.wrap, surface === 'document' && css.document)}>
      {fallback && (
        <textarea
          ref={fallbackRef}
          className={clsx(css.fallback, surface === 'document' && css.document)}
          aria-label={ariaLabel}
          defaultValue={value}
          spellCheck={false}
          wrap="soft"
          onChange={(event) => {
            if (syncState.current.composing) return
            const next = event.target.value
            if (next === lastEmitted.current) return
            emitMonacoBuffer(next, onChange, lastEmitted)
          }}
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
