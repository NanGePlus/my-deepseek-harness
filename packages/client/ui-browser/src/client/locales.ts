/** Locale keys owned by the embedded browser panel. */
export type BrowserPanelKey =
  | 'browser.tab.aria'
  | 'browser.tab.new'
  | 'browser.tab.close'
  | 'browser.tab.closeCurrent'
  | 'browser.tab.closeOthers'
  | 'browser.tab.closeAll'
  | 'browser.tab.closeLeft'
  | 'browser.tab.closeRight'
  | 'browser.nav.back'
  | 'browser.nav.forward'
  | 'browser.nav.reload'
  | 'browser.nav.address'
  | 'browser.nav.openExternal'
  | 'browser.native.aria'
  | 'browser.native.title'
  | 'browser.native.body'
  | 'browser.native.show'
  | 'browser.loading.connecting'
  | 'browser.empty.unbound.title'
  | 'browser.empty.unbound.body'
  | 'browser.empty.unavailable.title'
  | 'browser.empty.navFailure'
  | 'browser.info.external'
  | 'browser.nav.overflow'
  | 'browser.nav.hardReload'
  | 'browser.nav.copyUrl'
  | 'browser.nav.zoomOut'
  | 'browser.nav.zoomIn'
  | 'browser.nav.zoomReset'
  | 'browser.error.retry'
  | 'browser.error.invalidUrl'

/** Simplified Chinese copy for the embedded browser panel. */
export const zh: Record<BrowserPanelKey, string> = {
  'browser.tab.aria': '浏览器标签页',
  'browser.tab.new': '新建标签页',
  'browser.tab.close': '关闭',
  'browser.tab.closeCurrent': '关闭',
  'browser.tab.closeOthers': '关闭其他',
  'browser.tab.closeAll': '关闭全部',
  'browser.tab.closeLeft': '关闭左侧',
  'browser.tab.closeRight': '关闭右侧',
  'browser.nav.back': '后退',
  'browser.nav.forward': '前进',
  'browser.nav.reload': '刷新',
  'browser.nav.address': '地址栏',
  'browser.nav.openExternal': '在外部浏览器打开',
  'browser.native.aria': '本机浏览器窗口',
  'browser.native.title': '在本机浏览器窗口中查看',
  'browser.native.body': 'Agent 打开的页面会出现在本机 Chromium 窗口。请在该窗口内直接点击和输入，操作方式与系统浏览器相同。',
  'browser.native.show': '显示窗口',
  'browser.loading.connecting': '连接中…',
  'browser.empty.unbound.title': '无法使用浏览器',
  'browser.empty.unbound.body': '请先选择 Workspace 并开始会话。',
  'browser.empty.unavailable.title': '浏览器不可用',
  'browser.empty.navFailure': '无法加载此页',
  'browser.info.external': '正在访问外部站点',
  'browser.nav.overflow': '更多操作',
  'browser.nav.hardReload': 'Hard Reload',
  'browser.nav.copyUrl': 'Copy Current URL',
  'browser.nav.zoomOut': '缩小',
  'browser.nav.zoomIn': '放大',
  'browser.nav.zoomReset': '重置',
  'browser.error.retry': '重试',
  'browser.error.invalidUrl': '仅支持 http:// 或 https:// 地址',
}

/** English copy for the embedded browser panel. */
export const en: Record<BrowserPanelKey, string> = {
  'browser.tab.aria': 'Browser tabs',
  'browser.tab.new': 'New tab',
  'browser.tab.close': 'Close',
  'browser.tab.closeCurrent': 'Close',
  'browser.tab.closeOthers': 'Close others',
  'browser.tab.closeAll': 'Close all',
  'browser.tab.closeLeft': 'Close to the left',
  'browser.tab.closeRight': 'Close to the right',
  'browser.nav.back': 'Back',
  'browser.nav.forward': 'Forward',
  'browser.nav.reload': 'Reload',
  'browser.nav.address': 'Address bar',
  'browser.nav.openExternal': 'Open in external browser',
  'browser.native.aria': 'Native browser window',
  'browser.native.title': 'View in the native browser window',
  'browser.native.body': 'Pages the Agent opens appear in the local Chromium window. Click and type there; input matches the system browser.',
  'browser.native.show': 'Show window',
  'browser.loading.connecting': 'Connecting…',
  'browser.empty.unbound.title': 'Browser unavailable',
  'browser.empty.unbound.body': 'Select a Workspace and start a session first.',
  'browser.empty.unavailable.title': 'Browser unavailable',
  'browser.empty.navFailure': 'This page could not be loaded',
  'browser.info.external': 'Visiting an external site',
  'browser.nav.overflow': 'More actions',
  'browser.nav.hardReload': 'Hard Reload',
  'browser.nav.copyUrl': 'Copy Current URL',
  'browser.nav.zoomOut': 'Zoom out',
  'browser.nav.zoomIn': 'Zoom in',
  'browser.nav.zoomReset': 'Reset',
  'browser.error.retry': 'Retry',
  'browser.error.invalidUrl': 'Only http:// or https:// URLs are supported',
}
