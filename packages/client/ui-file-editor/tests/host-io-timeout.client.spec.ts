import { describe, expect, it, vi } from 'vitest'
import { withHostIoTimeout } from '../src/client/host-io-timeout.ts'

describe('withHostIoTimeout', () => {
  it('resolves when the operation completes first', async () => {
    const controller = new AbortController()
    await expect(withHostIoTimeout(Promise.resolve('ok'), controller, 50, 'timed out'))
      .resolves.toBe('ok')
  })

  it('rejects and aborts when the timeout elapses first', async () => {
    const controller = new AbortController()
    const abortSpy = vi.spyOn(controller, 'abort')
    await expect(withHostIoTimeout(new Promise(() => {}), controller, 20, 'file read timed out'))
      .rejects.toThrow('file read timed out')
    expect(abortSpy).toHaveBeenCalled()
  })
})
