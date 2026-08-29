/** Locale keys for the human terminal panel. */
export type TerminalPanelKey =
  | 'terminal.empty.unbound.title'
  | 'terminal.empty.unbound.body'
  | 'terminal.empty.unavailable.title'
  | 'terminal.error.retry'
  | 'terminal.loading.connecting'
  | 'terminal.tab.aria'
  | 'terminal.tab.new'
  | 'terminal.tab.kill'
  | 'terminal.viewport.aria'

/** Simplified Chinese copy for the human terminal panel. */
export const zh: Record<TerminalPanelKey, string> = {
  'terminal.empty.unbound.title': '无法使用终端',
  'terminal.empty.unbound.body': '请先选择 Workspace 并开始会话。',
  'terminal.empty.unavailable.title': '终端不可用',
  'terminal.error.retry': '重试',
  'terminal.loading.connecting': '连接中…',
  'terminal.tab.aria': '终端标签页',
  'terminal.tab.new': '新建终端',
  'terminal.tab.kill': '终止终端',
  'terminal.viewport.aria': '终端输出',
}

/** English copy for the human terminal panel. */
export const en: Record<TerminalPanelKey, string> = {
  'terminal.empty.unbound.title': 'Terminal unavailable',
  'terminal.empty.unbound.body': 'Select a Workspace and start a session first.',
  'terminal.empty.unavailable.title': 'Terminal unavailable',
  'terminal.error.retry': 'Retry',
  'terminal.loading.connecting': 'Connecting…',
  'terminal.tab.aria': 'Terminal tab',
  'terminal.tab.new': 'New terminal',
  'terminal.tab.kill': 'Kill terminal',
  'terminal.viewport.aria': 'Terminal output',
}
