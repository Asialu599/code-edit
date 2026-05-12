// ===== 项目 =====
export interface Project {
  id: string
  name: string
  rootPath: string
  expanded: boolean
  openedAt: number
}

// ===== 文件节点 =====
export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  expanded?: boolean
}

// ===== 文件搜索结果 =====
export interface FileSearchResult {
  name: string
  path: string
  projectRoot: string
  projectName: string
}

// ===== 标签页 =====
export type LanguageId = string
export type EditorTabKind = 'text' | 'image' | 'pdf' | 'external'

export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  language: LanguageId
  kind: EditorTabKind
  isDirty: boolean
}

// ===== 终端实例 =====
export interface TerminalInfo {
  id: string
  projectId: string
  cwd: string
  title: string
}

// ===== IPC 通道 =====
export const IPC = {
  // 文件系统
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_READ_DIR: 'fs:readDir',
  FS_SEARCH_FILES: 'fs:searchFiles',
  FS_DIR_CHANGED: 'fs:dirChanged',

  // 对话框
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',

  // 终端
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',

  // 窗口
  WINDOW_SET_TITLE: 'window:setTitle',
  WINDOW_OPEN_PATH: 'window:openPath',
} as const
