// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { SettingsRootComponentProps } from '../src/client/shell-contract.ts'
import { SettingsRoot } from '../src/client/SettingsRoot.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SettingsRoot desktop focus seam', () => {
  it('opens settings when desktop preload sends focus-settings', () => {
    let focusListener: (() => void) | undefined
    vi.stubGlobal('dsh', {
      onFocusSettings: (listener: () => void) => {
        focusListener = listener
        return () => { focusListener = undefined }
      },
    })
    const unusedHook = (() => { throw new Error('unused by SettingsRoot') }) as never
    const props: SettingsRootComponentProps = {
      wide: true,
      useSessions: ((select: (state: unknown) => unknown) => select({
        phase: 'ready',
        current: 'active-session',
        byId: { 'active-session': { blank: false } },
      })) as never,
      useWorkspaces: unusedHook,
      useOnboardingSteps: select => select([]),
      useSections: select => select([{ id: 'general', order: 0, label: 'General' }]),
      renderSlot: key => (key === 'settings.trigger' ? 'Settings' : null),
    }
    render(<SettingsRoot {...props} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => { focusListener?.() })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
