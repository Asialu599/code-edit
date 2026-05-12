import { ipcMain, dialog, shell } from 'electron'
import { IPC } from '../shared/types'
import { readFile, writeFile, readDir, searchFiles } from './fileService'
import { watchProject, unwatchProject } from './fileWatcher'
import { terminalManager } from './terminalManager'
import { getMainWindow } from './windowManager'

export function registerIpcHandlers(): void {
  // ===== 文件系统 =====

  ipcMain.handle(IPC.FS_READ_FILE, async (_e, filePath: string) => {
    return readFile(filePath)
  })

  ipcMain.handle(IPC.FS_WRITE_FILE, async (_e, filePath: string, content: string) => {
    await writeFile(filePath, content)
  })

  ipcMain.handle(IPC.FS_READ_DIR, async (_e, dirPath: string) => {
    return readDir(dirPath)
  })

  ipcMain.handle(
    IPC.FS_SEARCH_FILES,
    async (_e, projects: Array<{ name: string; rootPath: string }>, query: string) => {
      return searchFiles(projects, query)
    }
  )

  // ===== 对话框 =====

  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: '选择项目文件夹',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ===== 文件监听 =====

  ipcMain.handle('fs:watch', async (_e, rootPath: string) => {
    const win = getMainWindow()
    if (win) watchProject(rootPath, win)
  })

  ipcMain.handle('fs:unwatch', async (_e, rootPath: string) => {
    unwatchProject(rootPath)
  })

  // ===== 终端 =====

  ipcMain.handle(IPC.TERMINAL_CREATE, (_e, projectId: string, cwd: string) => {
    console.log('[IPC] terminal:create called, cwd:', cwd)
    const win = getMainWindow()
    if (!win) {
      console.error('[IPC] terminal:create - no main window')
      throw new Error('没有主窗口')
    }
    try {
      const termId = terminalManager.create(win, projectId, cwd)
      console.log('[IPC] terminal:create success, id:', termId)
      return termId
    } catch (err: any) {
      console.error('[IPC] 终端创建失败:', err)
      throw new Error(`终端创建失败: ${err.message}`)
    }
  })

  ipcMain.handle(IPC.TERMINAL_WRITE, (_e, id: string, data: string) => {
    terminalManager.write(id, data)
  })

  ipcMain.handle(IPC.TERMINAL_RESIZE, (_e, id: string, cols: number, rows: number) => {
    terminalManager.resize(id, cols, rows)
  })

  ipcMain.handle(IPC.TERMINAL_KILL, (_e, id: string) => {
    terminalManager.kill(id)
  })

  ipcMain.handle(IPC.TERMINAL_SET_PROXY, (_e, enabled: boolean, address: string) => {
    return terminalManager.setProxy({ enabled, address })
  })

  // ===== 窗口 =====

  ipcMain.handle(IPC.WINDOW_SET_TITLE, (_e, title: string) => {
    const win = getMainWindow()
    if (win) win.setTitle(title)
  })

  ipcMain.handle(IPC.WINDOW_OPEN_PATH, async (_e, targetPath: string) => {
    const error = await shell.openPath(targetPath)
    if (error) {
      throw new Error(error)
    }
  })
}
