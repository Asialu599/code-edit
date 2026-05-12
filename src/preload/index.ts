import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { IPC, FileNode, FileSearchResult, TerminalProxyConfig } from '../shared/types'

type DirChangeCallback = (event: string, filePath: string) => void
type TerminalDataCallback = (data: { id: string; data: string }) => void
type TerminalExitCallback = (data: { id: string; exitCode: number }) => void
type DirChangeCleanup = () => void

const api = {
  // ===== 文件系统 =====
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),

  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_WRITE_FILE, filePath, content),

  readDir: (dirPath: string): Promise<FileNode[]> =>
    ipcRenderer.invoke(IPC.FS_READ_DIR, dirPath),

  searchFiles: (
    projects: Array<{ name: string; rootPath: string }>,
    query: string
  ): Promise<FileSearchResult[]> =>
    ipcRenderer.invoke(IPC.FS_SEARCH_FILES, projects, query),

  // ===== 文件夹选择对话框 =====
  openFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER),

  // ===== 文件监听 =====
  watchDir: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:watch', rootPath),

  unwatchDir: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:unwatch', rootPath),

  onDirChanged: (cb: DirChangeCallback): DirChangeCleanup => {
    const handler = (_e: Electron.IpcRendererEvent, data: { event: string; filePath: string }) =>
      cb(data.event, data.filePath)
    ipcRenderer.on(IPC.FS_DIR_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.FS_DIR_CHANGED, handler)
  },

  // ===== 终端 =====
  createTerminal: (projectId: string, cwd: string): Promise<string> =>
    ipcRenderer.invoke(IPC.TERMINAL_CREATE, projectId, cwd),

  writeTerminal: (id: string, data: string): Promise<void> =>
    ipcRenderer.invoke(IPC.TERMINAL_WRITE, id, data),

  resizeTerminal: (id: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke(IPC.TERMINAL_RESIZE, id, cols, rows),

  killTerminal: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.TERMINAL_KILL, id),

  setTerminalProxy: (enabled: boolean, address: string): Promise<TerminalProxyConfig> =>
    ipcRenderer.invoke(IPC.TERMINAL_SET_PROXY, enabled, address),

  readClipboardText: (): string =>
    clipboard.readText(),

  writeClipboardText: (text: string): void => {
    clipboard.writeText(text)
  },

  onTerminalData: (cb: TerminalDataCallback): DirChangeCleanup => {
    const handler = (_e: Electron.IpcRendererEvent, data: { id: string; data: string }) => cb(data)
    ipcRenderer.on(IPC.TERMINAL_DATA, handler)
    return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, handler)
  },

  onTerminalExit: (cb: TerminalExitCallback): DirChangeCleanup => {
    const handler = (_e: Electron.IpcRendererEvent, data: { id: string; exitCode: number }) => cb(data)
    ipcRenderer.on(IPC.TERMINAL_EXIT, handler)
    return () => ipcRenderer.removeListener(IPC.TERMINAL_EXIT, handler)
  },

  // ===== 窗口 =====
  setWindowTitle: (title: string): Promise<void> =>
    ipcRenderer.invoke(IPC.WINDOW_SET_TITLE, title),

  openPath: (targetPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.WINDOW_OPEN_PATH, targetPath),

  // ===== 菜单事件 =====
  onMenuOpenFolder: (cb: (folderPath: string) => void): DirChangeCleanup => {
    const handler = (_e: Electron.IpcRendererEvent, folderPath: string) => cb(folderPath)
    ipcRenderer.on('menu:openFolder', handler)
    return () => ipcRenderer.removeListener('menu:openFolder', handler)
  },
  onMenuOpenFile: (cb: (filePath: string) => void): DirChangeCleanup => {
    const handler = (_e: Electron.IpcRendererEvent, filePath: string) => cb(filePath)
    ipcRenderer.on('menu:openFile', handler)
    return () => ipcRenderer.removeListener('menu:openFile', handler)
  },
  onMenuSave: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:save', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:save')
  },
  onMenuSaveAll: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:saveAll', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:saveAll')
  },
  onMenuCloseTab: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:closeTab', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:closeTab')
  },
  onMenuCloseProject: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:closeProject', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:closeProject')
  },
  onMenuToggleSidebar: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:toggleSidebar', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:toggleSidebar')
  },
  onMenuToggleTerminal: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:toggleTerminal', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:toggleTerminal')
  },
  onMenuToggleTheme: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:toggleTheme', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:toggleTheme')
  },
  onMenuNewTerminal: (cb: () => void): DirChangeCleanup => {
    ipcRenderer.on('menu:newTerminal', () => cb())
    return () => ipcRenderer.removeAllListeners('menu:newTerminal')
  },
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('electronAPI', api)
