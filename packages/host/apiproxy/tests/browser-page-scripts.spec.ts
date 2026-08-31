import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import {
  APPLY_SCROLL_AT_POINT, DISPATCH_FOCUSED_INPUT, FOCUS_EDITABLE_AT_POINT, READ_CSS_CURSOR_AT_POINT,
  asPageFunction,
} from '../src/browser-page-scripts.ts'

const child = fileURLToPath(new URL('./browser-evaluate-tsx-child.ts', import.meta.url))

function chromiumAvailable(): boolean {
  try {
    chromium.executablePath()
    return true
  } catch {
    return false
  }
}

describe('browser page.evaluate scripts', () => {
  it('keeps page-side scripts free of the tsx __name helper', () => {
    expect(APPLY_SCROLL_AT_POINT).not.toContain('__name')
    expect(FOCUS_EDITABLE_AT_POINT).not.toContain('__name')
    expect(DISPATCH_FOCUSED_INPUT).not.toContain('__name')
    expect(READ_CSS_CURSOR_AT_POINT).not.toContain('__name')
    expect(asPageFunction(APPLY_SCROLL_AT_POINT).toString()).not.toContain('__name')
  })

  it('focuses a text input that cancels mousedown', async () => {
    if (!chromiumAvailable()) return
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 240, height: 120 } })
    await page.setContent(`<input id="field" style="position:absolute;left:10px;top:10px;width:160px;height:28px"
      onmousedown="event.preventDefault()">`)
    await page.mouse.move(80, 24)
    await page.mouse.down()
    await page.mouse.up()
    const focused = await page.evaluate(
      asPageFunction<{ px: number; py: number }, boolean>(FOCUS_EDITABLE_AT_POINT),
      { px: 80, py: 24 },
    )
    expect(focused).toBe(true)
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('field')
    await page.keyboard.insertText('你好')
    expect(await page.evaluate(() => (document.getElementById('field') as HTMLInputElement).value)).toBe('你好')
    await browser.close()
  }, 25_000)

  it('scrolls under the tsx source launcher without page.evaluate ReferenceError', () => {
    if (!chromiumAvailable()) return
    const output = execFileSync(process.execPath, ['--import', 'tsx/esm', child], {
      encoding: 'utf8',
      timeout: 25_000,
    })
    expect(output).toContain('evaluate-ok')
  })
})
