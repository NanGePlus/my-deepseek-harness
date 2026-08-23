/** Atom block for fenced code and Mermaid — parsed from markdown, not editable in preview. */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { MarkdownCodeLabels, MermaidSecurityLevel } from '@deepseek-ai/dsh-client-ui-primitives'
import { ReadOnlyFencedBlockView } from './ReadOnlyFencedBlockView.tsx'

/** Options baked into the read-only fenced block node view. */
export interface ReadOnlyFencedBlockOptions {
  /** Copy labels for code fences rendered inside the block. */
  codeLabels: MarkdownCodeLabels
  /** Mermaid security level forwarded to the diagram renderer. */
  mermaidSecurityLevel: MermaidSecurityLevel
}

/**
 * Register a markdown code token handler that renders as a read-only atom block.
 * @param options - Code copy labels and Mermaid security level for the node view.
 */
export function createReadOnlyFencedBlock(options: ReadOnlyFencedBlockOptions) {
  return Node.create({
    name: 'readOnlyFencedBlock',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    addOptions() {
      return options
    },
    addAttributes() {
      return {
        language: { default: null as string | null },
        content: { default: '' },
      }
    },
    parseHTML() {
      return [{ tag: 'div[data-readonly-fenced-block]' }]
    },
    renderHTML({ node, HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-readonly-fenced-block': '',
          'data-language': node.attrs.language ?? '',
        }),
      ]
    },
    markdownTokenName: 'code',
    parseMarkdown(token) {
      const raw = token.raw ?? ''
      if (!raw.startsWith('```') && !raw.startsWith('~~~') && token.codeBlockStyle !== 'indented') {
        return []
      }
      return {
        type: 'readOnlyFencedBlock',
        attrs: {
          language: token.lang || null,
          content: token.text ?? '',
        },
      }
    },
    renderMarkdown(node) {
      const language = (node.attrs?.language as string | null | undefined) ?? ''
      const content = (node.attrs?.content as string | undefined) ?? ''
      return `\`\`\`${language}\n${content}\n\`\`\`\n`
    },
    addNodeView() {
      return ReactNodeViewRenderer(ReadOnlyFencedBlockView)
    },
  })
}
