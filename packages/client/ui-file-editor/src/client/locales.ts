/** Locale keys owned by the file editor surface plugin. */
export const zh = {
  'editor.empty.title': '未打开文件',
  'editor.empty.body': '从左侧文件树选择文件，或新建文件',
  'editor.empty.cta': '新建文件',
} as const

export const en = {
  'editor.empty.title': 'No file open',
  'editor.empty.body': 'Choose a file from the tree on the left, or create one',
  'editor.empty.cta': 'New file',
} as const

export type FileEditorKey = keyof typeof zh
