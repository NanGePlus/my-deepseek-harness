/** Dynamic monaco-editor import; undefined when the browser bundle cannot start. */

/** Minimal Monaco selection face used by source selection tooling. */
export interface MonacoSelection {
  isEmpty: () => boolean
  startLineNumber: number
  endLineNumber: number
  endColumn: number
}

/** Monaco mouse event carrying an optional document position. */
export interface MonacoMouseTargetEvent {
  event: MouseEvent
  target: { position?: { lineNumber: number; column: number } | null }
}

/** Minimal editor instance used by the editable-text widget. */
export interface MonacoStandaloneEditor {
  /** Current model text. */
  getValue: () => string
  /** Active text model, if any. */
  getModel: () => MonacoTextModel | null
  /** Current selection, if any. */
  getSelection: () => MonacoSelection | null
  /**
   * Replace the model text.
   * @param value - the new model text.
   */
  setValue: (value: string) => void
  /**
   * Subscribe to model edits.
   * @param listener - called after the model text changes.
   */
  onDidChangeModelContent: (listener: () => void) => void
  /**
   * Subscribe to selection changes.
   * @param listener - called after the selection changes.
   */
  onDidChangeCursorSelection: (listener: () => void) => { dispose: () => void }
  /**
   * Subscribe to editor blur events.
   * @param listener - called when the editor text surface loses focus.
   */
  onDidBlurEditorText: (listener: () => void) => { dispose: () => void }
  /**
   * Map a document position to coordinates inside the scrolled editor viewport.
   * @param position - one-based line and column.
   */
  getScrolledVisiblePosition: (
    position: { lineNumber: number; column: number },
  ) => { top: number; left: number; height: number } | null
  /** Root DOM node hosting the editor. */
  getDomNode: () => HTMLElement | null
  /** Release the editor. */
  dispose: () => void
  /** Replace the current selection. */
  setSelection: (selection: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }) => void
  /** Scroll one one-based line toward the vertical center of the viewport. */
  revealLineInCenter: (lineNumber: number) => void
  /** Subscribe to mouse down inside the editor. */
  onMouseDown: (listener: (event: MonacoMouseTargetEvent) => void) => { dispose: () => void }
  /** Subscribe to mouse move inside the editor. */
  onMouseMove: (listener: (event: { event: MouseEvent }) => void) => { dispose: () => void }
  /** Subscribe to mouse up inside the editor. */
  onMouseUp: (listener: (event: MonacoMouseTargetEvent) => void) => { dispose: () => void }
}

/** Minimal Monaco text model face used for diagnostics markers. */
export interface MonacoTextModel {
  /** Release the model. */
  dispose: () => void
  /** Total line count. */
  getLineCount: () => number
  /** Last column on one one-based line. */
  getLineMaxColumn: (lineNumber: number) => number
}

/** monaco-editor module face consumed by the widget. */
export interface MonacoEditorModule {
  MarkerSeverity: {
    Error: number
    Warning: number
    Info: number
    Hint: number
  }
  Uri: {
    file: (path: string) => unknown
  }
  editor: {
    /**
     * Register a named theme from Harness CSS tokens.
     * @param name - theme id passed to `create`.
     * @param theme - Monaco theme descriptor.
     */
    defineTheme: (
      name: string,
      theme: {
        base: 'vs' | 'vs-dark' | 'hc-black'
        inherit: boolean
        rules: readonly unknown[]
        colors: Record<string, string>
      },
    ) => void
    /**
     * Return an existing model for a URI, if one is open.
     * @param uri - model URI.
     */
    getModel: (uri: unknown) => MonacoTextModel | null
    /**
     * Create a text model bound to a URI.
     * @param value - initial text.
     * @param languageId - Monaco language id.
     * @param uri - model URI.
     */
    createModel: (value: string, languageId: string, uri: unknown) => MonacoTextModel
    /**
     * Replace diagnostics markers for one model and owner.
     * @param model - target model.
     * @param owner - marker owner id.
     * @param markers - Monaco marker descriptors.
     */
    setModelMarkers: (
      model: MonacoTextModel,
      owner: string,
      markers: readonly {
        severity: number
        message: string
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
      }[],
    ) => void
    /**
     * Mount a standalone editor.
     * @param host - DOM node that owns the editor.
     * @param options - Monaco `IStandaloneEditorConstructionOptions`.
     */
    create: (host: HTMLElement, options: Record<string, unknown>) => MonacoStandaloneEditor
  }
  languages?: {
    registerHoverProvider?: (
      languageId: string,
      provider: {
        provideHover: (
          model: unknown,
          position: { lineNumber: number; column: number },
          token: { onCancellationRequested: (listener: () => void) => { dispose: () => void } },
        ) => Promise<unknown>
      },
    ) => { dispose: () => void }
    typescript?: {
      typescriptDefaults: {
        modeConfiguration: Record<string, boolean>
        setDiagnosticsOptions: (options: Record<string, unknown>) => void
        setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
      }
      javascriptDefaults: {
        modeConfiguration: Record<string, boolean>
        setDiagnosticsOptions: (options: Record<string, unknown>) => void
        setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
      }
    }
    json?: {
      jsonDefaults: {
        modeConfiguration: Record<string, boolean>
        setDiagnosticsOptions: (options: Record<string, unknown>) => void
        setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
      }
    }
    html?: {
      htmlDefaults: {
        modeConfiguration: Record<string, boolean>
        setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
      }
    }
    css?: {
      cssDefaults: {
        modeConfiguration: Record<string, boolean>
        setDiagnosticsOptions: (options: Record<string, unknown>) => void
        setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
      }
      scssDefaults: {
        modeConfiguration: Record<string, boolean>
        setDiagnosticsOptions: (options: Record<string, unknown>) => void
        setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
      }
      lessDefaults: {
        modeConfiguration: Record<string, boolean>
        setDiagnosticsOptions: (options: Record<string, unknown>) => void
        setModeConfiguration: (modeConfiguration: Record<string, boolean>) => void
      }
    }
  }
  Range?: new (
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number,
  ) => unknown
}

/**
 * Import monaco-editor in the browser. jsdom and worker-less bundles reject.
 * `@vite-ignore` keeps Vitest from resolving the AMD package at transform time.
 * @returns the module, or `undefined` when the import rejects.
 */
export async function loadMonacoEditor(): Promise<MonacoEditorModule | undefined> {
  try {
    // monaco-editor's published types are wider than this widget face.
    return await import('monaco-editor') as unknown as MonacoEditorModule
  } catch (error: unknown) {
    // Dynamic import rejects when monaco-editor is missing or AMD-only.
    void error
    return undefined
  }
}
