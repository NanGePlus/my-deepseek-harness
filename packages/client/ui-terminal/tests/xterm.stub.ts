/** Vitest stand-in for `@xterm/xterm` and `@xterm/addon-fit`. */

export class Terminal {
  cols = 80
  rows = 24
  options: Record<string, unknown> = {}
  element: HTMLElement | undefined
  textarea: HTMLTextAreaElement | undefined
  onData(handler: (data: string) => void): { dispose: () => void } {
    this._onDataHandler = handler
    return { dispose() {} }
  }
  _onDataHandler: ((data: string) => void) | undefined
  loadAddon(): void {}
  open(host: HTMLElement): void {
    this.element = host
    this.textarea = document.createElement('textarea')
    host.appendChild(this.textarea)
  }
  write(): void {}
  clear(): void {}
  reset(): void {}
  dispose(): void {}
}

export class FitAddon {
  fit(): void {}
}

export default { Terminal }
