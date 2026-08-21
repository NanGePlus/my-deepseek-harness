// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('opens an enlarged viewer with zoom controls from the expand button', async () => {
    const { container } = render(<MermaidBlock source={'flowchart LR\n  A --> B\n'} />)
    await waitFor(() => {
      expect(container.querySelector('svg[data-source]')).not.toBeNull()
    })
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram' })
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('button', { name: '缩小' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '刷新' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '退出' }))
    expect(screen.queryByRole('dialog', { name: 'Mermaid diagram' })).toBeNull()
  })

  it('wheel zooms and left-drag pans inside the enlarged viewer', async () => {
    renderMock.mockResolvedValueOnce({
      svg: '<svg width="200" height="100" data-source="flowchart"></svg>',
    })
    render(<MermaidBlock source={'flowchart LR\n  A --> B\n'} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '放大' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    const viewport = screen.getByTestId('mermaid-lightbox-viewport')
    const host = viewport.firstElementChild as HTMLElement

    fireEvent.wheel(viewport, { deltaY: -100, clientX: 120, clientY: 80 })
    expect(host.style.transform).toContain('scale(1.25)')

    fireEvent.click(screen.getByRole('button', { name: '刷新' }))
    fireEvent.mouseDown(viewport, { button: 0, clientX: 50, clientY: 50 })
    fireEvent.mouseMove(document, { clientX: 90, clientY: 70 })
    expect(host.style.transform).toContain('translate(40px, 20px)')
  })
})
