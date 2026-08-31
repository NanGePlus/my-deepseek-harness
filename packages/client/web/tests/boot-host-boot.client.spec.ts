// @vitest-environment jsdom

/**
 * AppWebEntry integrated Host boot gate (Issue #121 / States host-boot-error).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { AppWebEntry } from '../src/boot.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (globalThis as { __DSH_HOST_BOOT__?: unknown }).__DSH_HOST_BOOT__
  delete (globalThis as { __DSH_BOOT__?: unknown }).__DSH_BOOT__
})

describe('AppWebEntry host boot wire', () => {
  it('host-boot-error: shows loud error and skips plugin boot', async () => {
    ;(globalThis as { __DSH_HOST_BOOT__?: { ok: boolean; error: string } }).__DSH_HOST_BOOT__ = {
      ok: false,
      error: 'Host unavailable',
    }
    const el = document.createElement('div')
    document.body.appendChild(el)
    const entry = new AppWebEntry(el)
    await act(async () => { await entry.run() })
    await waitFor(() => {
      expect(el.textContent).toContain('Host 启动失败')
    })
    expect(el.textContent).toContain('Host unavailable')
    entry.dispose()
  })

  it('host-boot-error: wires desktop retry when preload exposes retryHostBoot', async () => {
    const retryHostBoot = vi.fn(async () => ({ ok: true }))
    ;(globalThis as { __DSH_HOST_BOOT__?: { ok: boolean; error: string } }).__DSH_HOST_BOOT__ = {
      ok: false,
      error: 'boom',
    }
    vi.stubGlobal('dsh', { retryHostBoot })
    const el = document.createElement('div')
    document.body.appendChild(el)
    const entry = new AppWebEntry(el)
    await act(async () => { await entry.run() })
    await waitFor(() => {
      expect(el.querySelector('button')?.textContent).toContain('重试启动 Host')
    })
    const retry = el.querySelector('button')
    retry?.click()
    expect(retryHostBoot).toHaveBeenCalledOnce()
    entry.dispose()
  })
})
