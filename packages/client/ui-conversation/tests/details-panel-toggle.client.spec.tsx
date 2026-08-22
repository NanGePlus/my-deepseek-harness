// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { DetailsPanelToggle } from '../src/client/skeleton/DetailsPanelToggle.tsx'
import type { DetailsPanelToggleProps } from '../src/client/skeleton/DetailsPanelToggle.tsx'

describe('DetailsPanelToggle', () => {
  it('calls toggleDetails and shows the toolbox label with an action aria-label', () => {
    const toggleDetails = vi.fn()
    const props = {
      sessionId: 's1',
      toggleDetails,
      useDetailsOpen: (selector: (value: boolean) => boolean) => selector(false),
      t: (key: string) => {
        if (key === 'details.toggle.label') return '工具箱'
        if (key === 'details.toggle.open') return '打开工具箱'
        return '收起工具箱'
      },
    } as unknown as DetailsPanelToggleProps
    const view = render(<DetailsPanelToggle {...props} />)
    expect(view.getByRole('button', { name: '打开工具箱' })).toBeTruthy()
    expect(view.getByText('工具箱')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: '打开工具箱' }))
    expect(toggleDetails).toHaveBeenCalledTimes(1)
  })
})
