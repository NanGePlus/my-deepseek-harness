/** TipTap extension bundle for editable markdown preview (paragraphs + inline marks). */

import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import type { Extensions } from '@tiptap/core'
import type { MarkdownCodeLabels, MermaidSecurityLevel } from '@deepseek-ai/dsh-client-ui-primitives'
import { createReadOnlyFencedBlock } from './read-only-fenced-block.ts'

/** Options for {@link createEditableMarkdownExtensions}. */
export interface EditableMarkdownExtensionOptions {
  /** Copy labels for read-only code fences. */
  codeLabels: MarkdownCodeLabels
  /** Mermaid security level for read-only diagram fences. */
  mermaidSecurityLevel: MermaidSecurityLevel
}

/**
 * Build TipTap extensions for WYSIWYG markdown preview editing.
 * @param options - Labels and security settings for read-only fenced blocks.
 */
export function createEditableMarkdownExtensions(
  options: EditableMarkdownExtensionOptions,
): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: {
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      },
    }),
    Markdown,
    createReadOnlyFencedBlock({
      codeLabels: options.codeLabels,
      mermaidSecurityLevel: options.mermaidSecurityLevel,
    }),
  ]
}
