import { app, BrowserWindow, Menu } from 'electron'
import { createMainWindow, getMainWindow } from './windowManager'
import { registerIpcHandlers } from './ipcHandlers'
import { terminalManager } from './terminalManager'
import { unwatchAll } from './fileWatcher'
import { createMenu } from './menu'

function bootstrap(): void {
  registerIpcHandlers()

  const menu = createMenu(getMainWindow)
  Menu.setApplicationMenu(menu)

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  unwatchAll()
  const win = BrowserWindow.getAllWindows()[0]
  if (win) terminalManager.disposeForWindow(win.id)
})
