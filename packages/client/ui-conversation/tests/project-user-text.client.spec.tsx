// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  parseFileContextPromptBlocks,
  projectUserText,
} from '../src/client/chat/project-user-text.tsx'

const REF = '{"workspaceId":"ws","path":"/w/CONTEXT.md","startLine":19,"endLine":21}'
const META = 'eyJ3b3Jrc3BhY2VJZCI6IndzIiwicGF0aCI6Ii93L0NPTlRFWFQubWQiLCJzdGFydExpbmUiOjE5LCJlbmRMaW5lIjoyMX0'

function sampleFileContextBlock(excerpt: string): string {
  return `From \`CONTEXT.md\` (lines 19-21):\n\n\`\`\`\n${excerpt}\n\`\`\`\n<!--dsh:fc:${META}-->`
}

describe('parseFileContextPromptBlocks', () => {
  it('parses one serialized file-context block and its display metadata', () => {
    const text = sampleFileContextBlock('line19\nline20')
    const blocks = parseFileContextPromptBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.label).toBe('CONTEXT.md (19-21)')
    expect(blocks[0]?.ref).toBe(REF)
  })

  it('parses legacy blocks without metadata as non-clickable labels', () => {
    const text = 'From `CONTEXT.md` (lines 19-21):\n\n```\nexcerpt\n```'
    const blocks = parseFileContextPromptBlocks(text)
    expect(blocks).toEqual([{
      match: text,
      start: 0,
      label: 'CONTEXT.md (19-21)',
    }])
  })
})

describe('projectUserText', () => {
  it('renders a file-context block as a pill instead of the full excerpt', () => {
    render(<div>{projectUserText(sampleFileContextBlock('line19\nline20'))}</div>)
    expect(screen.getByText('CONTEXT.md (19-21)')).toBeTruthy()
    expect(screen.queryByText('line19')).toBeNull()
    expect(screen.queryByText(/From `/)).toBeNull()
  })

  it('opens encoded references when a chip is clicked', () => {
    const openReferenceChip = vi.fn()
    render(<div>{projectUserText(`prefix ${sampleFileContextBlock('line19')} suffix`, openReferenceChip)}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'CONTEXT.md (19-21)' }))
    expect(openReferenceChip).toHaveBeenCalledWith('file-context', REF)
    expect(screen.getByText('prefix')).toBeTruthy()
    expect(screen.getByText('suffix')).toBeTruthy()
  })

  it('still decorates slash and subagent tokens outside file-context blocks', () => {
    render(<div>{projectUserText('use /alpha then @worker-1 ')}</div>)
    expect(screen.getByText('/alpha')).toBeTruthy()
    expect(screen.getByText('@worker-1')).toBeTruthy()
  })
})
