// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { DetailsPanelToggle } from '../src/client/skeleton/DetailsPanelToggle.tsx'
import type { DetailsPanelToggleProps } from '../src/client/skeleton/DetailsPanelToggle.tsx'

describe('DetailsPanelToggle', () => {
  it('calls toggleDetails and reflects the open label', () => {
    const toggleDetails = vi.fn()
    const props = {
      sessionId: 's1',
      toggleDetails,
      useDetailsOpen: (selector: (value: boolean) => boolean) => selector(false),
      t: (key: string) => key === 'details.toggle.open' ? '打开详情栏' : '收起详情栏',
    } as unknown as DetailsPanelToggleProps
    const view = render(<DetailsPanelToggle {...props} />)
    fireEvent.click(view.getByRole('button', { name: '打开详情栏' }))
    expect(toggleDetails).toHaveBeenCalledTimes(1)
  })
})
