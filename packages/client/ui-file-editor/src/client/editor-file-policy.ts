/** Editor performance policy for large or minified file buffers. */

/** Skip LSP sync and hover when UTF-16 length exceeds this. */
export const LSP_SKIP_CHAR_LENGTH = 512 * 1024

/** Enable Monaco large-file mode when encoded byte length exceeds this. */
export const MONACO_LARGE_FILE_BYTES = 256 * 1024

/** Disable word wrap when any line exceeds this UTF-16 length. */
export const MONACO_LONG_LINE_CHARS = 10_000

/**
 * UTF-8 byte length of a JavaScript string.
 * @param text - buffer text.
 */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/**
 * Whether any line in `text` exceeds `maxChars`.
 * Stops at the first long line.
 * @param text - buffer text.
 * @param maxChars - UTF-16 line length threshold.
 */
export function hasLongLine(text: string, maxChars: number = MONACO_LONG_LINE_CHARS): boolean {
  let lineStart = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      if (i - lineStart > maxChars) return true
      lineStart = i + 1
    }
  }
  return text.length - lineStart > maxChars
}

/**
 * Whether LSP sync and hover should be skipped for this buffer.
 * @param text - buffer text.
 */
export function shouldSkipLsp(text: string): boolean {
  return text.length > LSP_SKIP_CHAR_LENGTH || hasLongLine(text)
}

/** Monaco editor options derived from buffer size and line shape. */
export interface MonacoContentOptions {
  largeFileOptimizations: boolean
  wordWrap: 'off' | 'on'
  wrappingStrategy: 'simple' | 'advanced'
}

/** Monaco surface options after language-specific IME and wrap tuning. */
export interface MonacoSurfaceOptions {
  wordWrap: MonacoContentOptions['wordWrap']
  wrappingStrategy: MonacoContentOptions['wrappingStrategy']
  /** Set for markdown to keep CJK IME preedit aligned while soft wrap is on. */
  accessibilitySupport?: 'off'
}

/**
 * Monaco wrap and accessibility options for a language id.
 * Markdown keeps soft wrap but uses simple wrapping plus accessibility off so
 * CJK IME preedit stays at the cursor instead of jumping on wrapped lines.
 * @param language - Monaco language id.
 * @param contentOptions - Size-derived wrap defaults.
 */
export function monacoSurfaceOptionsForLanguage(
  language: string,
  contentOptions: MonacoContentOptions,
): MonacoSurfaceOptions {
  const { wordWrap } = contentOptions
  if (language === 'markdown') {
    return {
      wordWrap,
      wrappingStrategy: 'simple',
      accessibilitySupport: 'off',
    }
  }
  return {
    wordWrap,
    wrappingStrategy: wordWrap === 'off' ? 'simple' : contentOptions.wrappingStrategy,
  }
}

/**
 * Monaco options that avoid main-thread stalls on large or minified buffers.
 * @param text - buffer text at open or remount time.
 */
export function monacoOptionsForContent(text: string): MonacoContentOptions {
  const longLine = hasLongLine(text)
  const large = utf8ByteLength(text) > MONACO_LARGE_FILE_BYTES || longLine
  return {
    largeFileOptimizations: large,
    wordWrap: longLine ? 'off' : 'on',
    wrappingStrategy: longLine ? 'simple' : 'advanced',
  }
}

/**
 * Yield one macrotask so the UI can paint before heavy editor work.
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0) })
}
