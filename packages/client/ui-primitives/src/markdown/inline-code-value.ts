/**
 * Inline-code tokens that carry no visible glyphs after whitespace and
 * format-character stripping. Models often emit these inside backtick pairs.
 */
const BLANK_INLINE_CODE = /[\s\u200B-\u200D\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\u00AD]/g

/**
 * True when an inline-code token should not render as a code chip.
 * @param value - Parsed inline-code text, with line endings already normalized.
 */
export function isBlankInlineCodeValue(value: string): boolean {
  return value.replace(BLANK_INLINE_CODE, '') === ''
}
