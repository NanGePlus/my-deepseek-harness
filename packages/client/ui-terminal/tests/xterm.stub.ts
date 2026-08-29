/** Vitest stand-in for `@xterm/xterm` and `@xterm/addon-fit`. */

export class Terminal {
  cols = 80
  rows = 24
  options: Record<string, unknown> = {}
  element: HTMLElement | undefined
  onData = (_handler: (data: string) => void): { dispose: () => void } => ({ dispose() {} })
  loadAddon(): void {}
  open(host: HTMLElement): void {
    this.element = host
  }
  write(): void {}
  dispose(): void {}
}

export class FitAddon {
  fit(): void {}
}

export default { Terminal }
