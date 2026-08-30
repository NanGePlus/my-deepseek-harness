import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import {
  browseErrorMessage, isIgnorableBrowseError, reportBrowserFailure,
} from '../src/client/browser-failure.ts'

const WID = 'ws1' as WorkspaceId

describe('browser failure helpers', () => {
  it('maps DirectoryBrowseError and generic Error messages', () => {
    expect(browseErrorMessage(new DirectoryBrowseError({
      code: 'browser-unavailable',
      message: 'no chromium',
      details: { reason: 'chromium-missing' },
    }))).toBe('no chromium')
    expect(browseErrorMessage(new Error('network'))).toBe('network')
    expect(browseErrorMessage('plain')).toBeUndefined()
  })

  it('ignores workspace-not-found browse errors', () => {
    const err = new DirectoryBrowseError({
      code: 'workspace-not-found', message: 'missing', details: { workspaceId: 'missing' },
    })
    expect(isIgnorableBrowseError(err)).toBe(true)
    const actions = { setInlineError: vi.fn() }
    reportBrowserFailure(actions, WID, err)
    expect(actions.setInlineError).not.toHaveBeenCalled()
  })

  it('reports inline errors for actionable browse failures', () => {
    const actions = { setInlineError: vi.fn() }
    reportBrowserFailure(actions, WID, new Error('failed'))
    expect(actions.setInlineError).toHaveBeenCalledWith(WID, 'failed')
  })

  it('ignores failures with no user-visible message', () => {
    const actions = { setInlineError: vi.fn() }
    reportBrowserFailure(actions, WID, { reason: 'opaque' })
    expect(actions.setInlineError).not.toHaveBeenCalled()
  })
})
