/** Locale keys owned by the embedded browser panel. */
export type BrowserPanelKey =
  | 'browser.tab.aria'
  | 'browser.tab.new'
  | 'browser.tab.close'
  | 'browser.nav.back'
  | 'browser.nav.forward'
  | 'browser.nav.reload'
  | 'browser.nav.address'
  | 'browser.screencast.aria'
  | 'browser.loading.connecting'
  | 'browser.empty.unbound.title'
  | 'browser.empty.unbound.body'
  | 'browser.error.retry'

/** Simplified Chinese copy for the embedded browser panel. */
export const zh: Record<BrowserPanelKey, string> = {
  'browser.tab.aria': '浏览器标签页',
  'browser.tab.new': '新建标签页',
  'browser.tab.close': '关闭',
  'browser.nav.back': '后退',
  'browser.nav.forward': '前进',
  'browser.nav.reload': '刷新',
  'browser.nav.address': '地址栏',
  'browser.screencast.aria': '浏览器画面',
  'browser.loading.connecting': '连接中…',
  'browser.empty.unbound.title': '无法使用浏览器',
  'browser.empty.unbound.body': '请先选择 Workspace 并开始会话。',
  'browser.error.retry': '重试',
}

/** English copy for the embedded browser panel. */
export const en: Record<BrowserPanelKey, string> = {
  'browser.tab.aria': 'Browser tabs',
  'browser.tab.new': 'New tab',
  'browser.tab.close': 'Close',
  'browser.nav.back': 'Back',
  'browser.nav.forward': 'Forward',
  'browser.nav.reload': 'Reload',
  'browser.nav.address': 'Address bar',
  'browser.screencast.aria': 'Browser view',
  'browser.loading.connecting': 'Connecting…',
  'browser.empty.unbound.title': 'Browser unavailable',
  'browser.empty.unbound.body': 'Select a Workspace and start a session first.',
  'browser.error.retry': 'Retry',
}
