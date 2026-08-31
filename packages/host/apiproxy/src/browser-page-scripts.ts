/**
 * Page-side Playwright evaluate sources.
 * These stay string literals so `node --import tsx/esm` cannot inject `__name`
 * into a function body that Playwright then evals in the page.
 */

/**
 * Build a page function whose `toString()` is the given source, not a tsx-wrapped closure.
 * @param source - function-expression source that accepts one argument.
 * @returns a function Playwright can serialize without `__name`.
 */
export function asPageFunction<Arg, Result>(source: string): (arg: Arg) => Result {
  return new Function('arg', `"use strict"; return (${source})(arg);`) as (arg: Arg) => Result
}

/** Scroll the first overflow container under a viewport point. */
export const APPLY_SCROLL_AT_POINT = `({ px, py, dx, dy }) => {
  const canScroll = (el, horizontal, vertical) => {
    if (!(el instanceof HTMLElement)) return false
    const style = getComputedStyle(el)
    const overflowX = style.overflowX
    const overflowY = style.overflowY
    const xOk = horizontal
      && (overflowX === 'auto' || overflowX === 'scroll')
      && el.scrollWidth > el.clientWidth
    const yOk = vertical
      && (overflowY === 'auto' || overflowY === 'scroll')
      && el.scrollHeight > el.clientHeight
    return xOk || yOk
  }
  let node = document.elementFromPoint(px, py)
  let root = node && node.shadowRoot
  while (node !== null && root !== null && root !== undefined) {
    const next = root.elementFromPoint(px, py)
    if (next === null || next === node) break
    node = next
    root = node.shadowRoot
  }
  const wantX = dx !== 0
  const wantY = dy !== 0
  while (node !== null) {
    if (canScroll(node, wantX, wantY)) {
      node.scrollBy(dx, dy)
      return
    }
    if (node.parentElement !== null) {
      node = node.parentElement
      continue
    }
    const tree = node.getRootNode()
    node = tree instanceof ShadowRoot ? tree.host : null
  }
  document.scrollingElement && document.scrollingElement.scrollBy(dx, dy)
}`

/** Focus the editable control under a viewport point (inputs that cancel mousedown still need this). */
export const FOCUS_EDITABLE_AT_POINT = `({ px, py }) => {
  const pierce = (x, y) => {
    let node = document.elementFromPoint(x, y)
    let root = node && node.shadowRoot
    while (node !== null && root !== null && root !== undefined) {
      const next = root.elementFromPoint(x, y)
      if (next === null || next === node) break
      node = next
      root = node.shadowRoot
    }
    return node
  }
  const isEditable = (el) => {
    if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly
    if (el instanceof HTMLInputElement) {
      if (el.disabled || el.readOnly) return false
      return el.selectionStart !== null
    }
    return el instanceof HTMLElement && el.isContentEditable
  }
  let node = pierce(px, py)
  while (node !== null) {
    if (isEditable(node)) {
      const styleId = 'dsh-screencast-focus'
      if (document.getElementById(styleId) === null) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = '[data-dsh-screencast-focus]{outline:2px solid #4c8bf5!important;outline-offset:-1px}'
        document.documentElement.appendChild(style)
      }
      for (const marked of document.querySelectorAll('[data-dsh-screencast-focus]')) {
        marked.removeAttribute('data-dsh-screencast-focus')
      }
      node.setAttribute('data-dsh-screencast-focus', '')
      node.focus()
      return true
    }
    if (node.parentElement !== null) {
      node = node.parentElement
      continue
    }
    const tree = node.getRootNode()
    node = tree instanceof ShadowRoot ? tree.host : null
  }
  return false
}`

/** Dispatch an `input` event on the focused editable so React-style listeners see inserted text. */
export const DISPATCH_FOCUSED_INPUT = `({ text }) => {
  const el = document.activeElement
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (!el.value.endsWith(text)) el.value += text
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
    return
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    if (!el.innerText.includes(text)) el.append(text)
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
  }
}`

/** Read computed CSS cursor at a viewport point. */
export const READ_CSS_CURSOR_AT_POINT = `({ px, py }) => {
  let node = document.elementFromPoint(px, py)
  let root = node && node.shadowRoot
  while (node !== null && root !== null && root !== undefined) {
    const next = root.elementFromPoint(px, py)
    if (next === null || next === node) break
    node = next
    root = node.shadowRoot
  }
  if (node === null) return 'auto'
  const value = getComputedStyle(node).cursor
  return value === '' ? 'auto' : value
}`
