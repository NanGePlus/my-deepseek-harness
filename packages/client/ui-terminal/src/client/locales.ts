/** Locale keys for the human terminal panel. */
export type TerminalPanelKey =
  | 'terminal.empty.unbound.title'
  | 'terminal.empty.unbound.body'
  | 'terminal.empty.unavailable.title'
  | 'terminal.error.retry'
  | 'terminal.loading.connecting'
  | 'terminal.tab.aria'
  | 'terminal.tab.new'
  | 'terminal.tab.close'
  | 'terminal.tab.closeCurrent'
  | 'terminal.tab.closeOthers'
  | 'terminal.tab.closeAll'
  | 'terminal.tab.closeLeft'
  | 'terminal.tab.closeRight'
  | 'terminal.dialog.close'
  | 'terminal.dialog.runningGuard.title'
  | 'terminal.dialog.runningGuard.desc'
  | 'terminal.dialog.runningGuard.cancel'
  | 'terminal.dialog.runningGuard.confirm'
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
  'terminal.tab.close': '关闭 {name}',
  'terminal.tab.closeCurrent': '关闭',
  'terminal.tab.closeOthers': '关闭其他',
  'terminal.tab.closeAll': '关闭全部',
  'terminal.tab.closeLeft': '关闭左侧',
  'terminal.tab.closeRight': '关闭右侧',
  'terminal.dialog.close': '关闭',
  'terminal.dialog.runningGuard.title': '终止正在运行的命令？',
  'terminal.dialog.runningGuard.desc': '终端「{names}」正在运行命令。关闭将终止这些进程。',
  'terminal.dialog.runningGuard.cancel': '取消',
  'terminal.dialog.runningGuard.confirm': '关闭',
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
  'terminal.tab.close': 'Close {name}',
  'terminal.tab.closeCurrent': 'Close',
  'terminal.tab.closeOthers': 'Close Others',
  'terminal.tab.closeAll': 'Close All',
  'terminal.tab.closeLeft': 'Close to the Left',
  'terminal.tab.closeRight': 'Close to the Right',
  'terminal.dialog.close': 'Close',
  'terminal.dialog.runningGuard.title': 'Stop running commands?',
  'terminal.dialog.runningGuard.desc': 'Terminal tabs "{names}" are running commands. Closing will terminate those processes.',
  'terminal.dialog.runningGuard.cancel': 'Cancel',
  'terminal.dialog.runningGuard.confirm': 'Close',
  'terminal.viewport.aria': 'Terminal output',
}
