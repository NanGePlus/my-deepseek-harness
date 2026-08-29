/** Locale keys for the human terminal panel. */
export type TerminalPanelKey =
  | 'terminal.empty.unbound.title'
  | 'terminal.empty.unbound.body'
  | 'terminal.loading.connecting'
  | 'terminal.tab.aria'
  | 'terminal.viewport.aria'

/** Simplified Chinese copy for the human terminal panel. */
export const zh: Record<TerminalPanelKey, string> = {
  'terminal.empty.unbound.title': '无法使用终端',
  'terminal.empty.unbound.body': '请先选择 Workspace 并开始会话。',
  'terminal.loading.connecting': '连接中…',
  'terminal.tab.aria': '终端标签页',
  'terminal.viewport.aria': '终端输出',
}

/** English copy for the human terminal panel. */
export const en: Record<TerminalPanelKey, string> = {
  'terminal.empty.unbound.title': 'Terminal unavailable',
  'terminal.empty.unbound.body': 'Select a Workspace and start a session first.',
  'terminal.loading.connecting': 'Connecting…',
  'terminal.tab.aria': 'Terminal tab',
  'terminal.viewport.aria': 'Terminal output',
}
