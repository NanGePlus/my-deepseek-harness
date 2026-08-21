// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { MermaidBlock } from '../src/markdown/MermaidBlock.tsx'

const renderMock = vi.hoisted(() => vi.fn(async (_id: string, source: string) => ({
  svg: `<svg data-source="${source.replace(/"/g, '&quot;')}"></svg>`,
})))

vi.mock('../src/markdown/mermaid-load.ts', () => ({
  renderMermaidDiagram: vi.fn(async (id: string, source: string) => {
    const result = await renderMock(id, source)
    return result.svg
  }),
  mermaidTheme: () => 'neutral' as const,
}))

afterEach(() => {
  cleanup()
  renderMock.mockClear()
})

describe('Mermaid markdown fences', () => {
  it('streaming keeps mermaid fences literal', () => {
    const { container } = render(
      <MarkdownText text={'```mermaid\nflowchart LR\n  A --> B\n```'} streaming />,
    )
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('pre code')?.textContent).toContain('flowchart LR')
  })

  it('settled mermaid fences render as SVG diagrams', async () => {
    const { container } = render(
      <MarkdownText text={'```mermaid\nflowchart LR\n  A --> B\n```'} />,
    )
    await waitFor(() => {
      expect(container.querySelector('svg[data-source]')).not.toBeNull()
    })
    expect(renderMock).toHaveBeenCalled()
  })

  it('falls back to a code block when rendering fails', async () => {
    renderMock.mockRejectedValueOnce(new Error('bad diagram'))
    const { container } = render(<MermaidBlock source={'bad\n'} />)
    await waitFor(() => {
      expect(container.querySelector('.md-code-block')).not.toBeNull()
    })
    expect(container.querySelector('svg[data-source]')).toBeNull()
  })
})
