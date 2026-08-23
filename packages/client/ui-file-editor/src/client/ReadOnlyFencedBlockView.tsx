/** React node view for read-only fenced code and Mermaid blocks in the markdown preview editor. */

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReadOnlyFencedBlockOptions } from './read-only-fenced-block.ts'
import css from './EditableMarkdownPreview.module.css'

/**
 * Render one fenced markdown block with the shared MarkdownText pipeline.
 * @param props - TipTap node view props for a read-only fenced block.
 */
export function ReadOnlyFencedBlockView({ node, extension }: NodeViewProps) {
  const { codeLabels, mermaidSecurityLevel } = extension.options as ReadOnlyFencedBlockOptions
  const language = (node.attrs.language as string | null | undefined) ?? ''
  const content = (node.attrs.content as string | undefined) ?? ''
  const fence = language.length > 0 ? `\`\`\`${language}\n${content}\n\`\`\`` : `\`\`\`\n${content}\n\`\`\``

  return (
    <NodeViewWrapper
      as="div"
      className={css.fencedBlock}
      contentEditable={false}
      data-readonly-fenced-block=""
      data-language={language}
    >
      <MarkdownText
        text={fence}
        mermaidSecurityLevel={mermaidSecurityLevel}
        codeLabels={codeLabels}
      />
    </NodeViewWrapper>
  )
}
