/** Dynamic monaco-editor import; undefined when the browser bundle cannot start. */

/** Minimal editor instance used by the editable-text widget. */
export interface MonacoStandaloneEditor {
  /** Current model text. */
  getValue: () => string
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
  /** Release the editor. */
  dispose: () => void
}

/** monaco-editor module face consumed by the widget. */
export interface MonacoEditorModule {
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
     * Mount a standalone editor.
     * @param host - DOM node that owns the editor.
     * @param options - Monaco `IStandaloneEditorConstructionOptions`.
     */
    create: (host: HTMLElement, options: Record<string, unknown>) => MonacoStandaloneEditor
  }
}

/**
 * Import monaco-editor in the browser. jsdom and worker-less bundles reject.
 * `@vite-ignore` keeps Vitest from resolving the AMD package at transform time.
 * @returns the module, or `undefined` when the import rejects.
 */
export async function loadMonacoEditor(): Promise<MonacoEditorModule | undefined> {
  try {
    return await import('monaco-editor') as MonacoEditorModule
  } catch (error: unknown) {
    // Dynamic import rejects when monaco-editor is missing or AMD-only.
    void error
    return undefined
  }
}
