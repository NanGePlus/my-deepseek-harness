/** Locale keys owned by the Git panel surface plugin. */
export const zh = {
  'git.loading': '加载中…',
  'git.refresh': '刷新 Git 状态',
  'git.branch': '分支 {name}',
  'git.commit.placeholder': '提交说明',
  'git.commit.submit': '提交',
  'git.section.unstaged': '更改',
  'git.section.staged': '暂存的更改',
  'git.empty.clean': '没有要提交的更改',
  'git.empty.preview': '选择一个文件以查看差异',
  'git.empty.unavailable.title': 'Git 不可用',
  'git.empty.unavailable.body': '找不到可用的 git。安装 git 并确保它在 PATH 中。',
  'git.empty.notRepo.title': '不是 Git 仓库',
  'git.empty.notRepo.body': '当前绑定目录向上找不到 Git 仓库。',
  'git.init': '初始化仓库',
  'git.icon.file': '文件',
} as const

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'git.loading': 'Loading…',
  'git.refresh': 'Refreshing Git status',
  'git.branch': 'Branch {name}',
  'git.commit.placeholder': 'Commit message',
  'git.commit.submit': 'Commit',
  'git.section.unstaged': 'Changes',
  'git.section.staged': 'Staged Changes',
  'git.empty.clean': 'No changes to commit',
  'git.empty.preview': 'Select a file to view diffs',
  'git.empty.unavailable.title': 'Git unavailable',
  'git.empty.unavailable.body': 'No usable git was found. Install git and make sure it is on PATH.',
  'git.empty.notRepo.title': 'Not a Git repository',
  'git.empty.notRepo.body': 'No Git repository was found above the bound directory.',
  'git.init': 'Initialize repository',
  'git.icon.file': 'File',
} as const

/** The gitPanel namespace key union. */
export type GitPanelKey = keyof typeof zh
