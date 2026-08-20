/** Locale keys owned by the file editor surface plugin. */
export const zh = {
  'editor.empty.title': '未打开文件',
  'editor.empty.body': '从左侧文件树选择文件，或新建文件',
  'editor.empty.cta': '新建文件',
  'editor.tree.filter.placeholder': '按文件名过滤',
  'editor.tree.filter.clear': '清除过滤',
  'editor.tree.filter.noMatch': '无匹配文件',
  'editor.tree.empty.title': '此目录为空',
  'editor.tree.empty.cta': '新建文件',
  'editor.tree.newFile': '新建文件',
  'editor.tree.newFolder': '新建文件夹',
  'editor.tree.expand': '展开 {name}',
  'editor.tree.collapse': '折叠 {name}',
  'editor.tree.icon.folder': '文件夹',
  'editor.tree.icon.file': '文件',
  'editor.tree.git.loading': 'Git 状态加载中',
  'editor.tree.git.badge': 'Git {letter}',
  'editor.tree.loading': '加载中',
  'editor.tree.label': '文件树',
} as const

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'editor.empty.title': 'No file open',
  'editor.empty.body': 'Choose a file from the tree on the left, or create one',
  'editor.empty.cta': 'New file',
  'editor.tree.filter.placeholder': 'Filter by filename',
  'editor.tree.filter.clear': 'Clear filter',
  'editor.tree.filter.noMatch': 'No matching files',
  'editor.tree.empty.title': 'This folder is empty',
  'editor.tree.empty.cta': 'New file',
  'editor.tree.newFile': 'New file',
  'editor.tree.newFolder': 'New folder',
  'editor.tree.expand': 'Expand {name}',
  'editor.tree.collapse': 'Collapse {name}',
  'editor.tree.icon.folder': 'Folder',
  'editor.tree.icon.file': 'File',
  'editor.tree.git.loading': 'Loading Git status',
  'editor.tree.git.badge': 'Git {letter}',
  'editor.tree.loading': 'Loading',
  'editor.tree.label': 'File tree',
} as const

/** The fileEditor namespace key union. */
export type FileEditorKey = keyof typeof zh
