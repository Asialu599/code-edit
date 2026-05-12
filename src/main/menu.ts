import { Menu, dialog, BrowserWindow, app } from 'electron'

export function createMenu(getWindow: () => BrowserWindow | null): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开文件夹...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = getWindow()
            if (!win) return
            const result = await dialog.showOpenDialog(win, {
              properties: ['openDirectory'],
              title: '选择项目文件夹',
            })
            if (!result.canceled && result.filePaths.length > 0) {
              win.webContents.send('menu:openFolder', result.filePaths[0])
            }
          },
        },
        {
          label: '打开文件...',
          accelerator: 'CmdOrCtrl+P',
          click: async () => {
            const win = getWindow()
            if (!win) return
            const result = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
              title: '选择文件',
            })
            if (!result.canceled && result.filePaths.length > 0) {
              win.webContents.send('menu:openFile', result.filePaths[0])
            }
          },
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:save')
          },
        },
        {
          label: '全部保存',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:saveAll')
          },
        },
        { type: 'separator' },
        {
          label: '关闭文件',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:closeTab')
          },
        },
        {
          label: '关闭文件夹',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:closeProject')
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo',
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Shift+Z',
          role: 'redo',
        },
        { type: 'separator' },
        {
          label: '剪切',
          role: 'cut',
        },
        {
          label: '复制',
          role: 'copy',
        },
        {
          label: '粘贴',
          role: 'paste',
        },
        { type: 'separator' },
        {
          label: '查找',
          accelerator: 'CmdOrCtrl+F',
          role: 'toggleFind',
        },
        {
          label: '替换',
          accelerator: 'CmdOrCtrl+H',
          role: 'toggleReplace',
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换侧边栏',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:toggleSidebar')
          },
        },
        {
          label: '切换终端',
          accelerator: 'CmdOrCtrl+`',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:toggleTerminal')
          },
        },
        {
          label: '💡 切换明暗主题',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:toggleTheme')
          },
        },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+=',
          role: 'zoomIn',
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          role: 'zoomOut',
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          role: 'resetZoom',
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'F12',
          role: 'toggleDevTools',
        },
      ],
    },
    {
      label: '终端',
      submenu: [
        {
          label: '新建终端',
          accelerator: 'CmdOrCtrl+Shift+`',
          click: () => {
            const win = getWindow()
            if (win) win.webContents.send('menu:newTerminal')
          },
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于 CodeEdit',
              message: 'CodeEdit v1.0.0',
              detail: '多项目代码编辑器 — 支持语法高亮、多项目管理、集成终端。\n\n基于 Electron + Monaco Editor + xterm.js 构建。',
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  return menu
}
