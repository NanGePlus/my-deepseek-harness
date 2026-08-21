import { describe, expect, it, vi } from 'vitest'
import { withDirectoryListingTimeout } from '../src/client/directory-listing-timeout.ts'

describe('withDirectoryListingTimeout', () => {
  it('resolves when the operation completes first', async () => {
    const controller = new AbortController()
    await expect(withDirectoryListingTimeout(Promise.resolve('ok'), controller, 50))
      .resolves.toBe('ok')
  })

  it('rejects and aborts when the timeout elapses first', async () => {
    const controller = new AbortController()
    const abortSpy = vi.spyOn(controller, 'abort')
    await expect(withDirectoryListingTimeout(new Promise(() => {}), controller, 20))
      .rejects.toThrow('directory listing timed out')
    expect(abortSpy).toHaveBeenCalled()
  })
})
