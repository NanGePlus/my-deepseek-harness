/** Vitest stand-in for `monaco-editor`: create throws so the widget uses the textarea fallback. */

export const editor = {
  defineTheme(): void {},
  create(): never {
    throw new Error('monaco-editor stub: jsdom has no editor runtime')
  },
}
