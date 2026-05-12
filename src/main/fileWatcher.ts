import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'
import { IPC } from '../shared/types'

const watchers = new Map<string, chokidar.FSWatcher>()

export function watchProject(rootPath: string, window: BrowserWindow): void {
  if (watchers.has(rootPath)) return

  const watcher = chokidar.watch(rootPath, {
    ignored: [
      /(^|[\/\\])\../,      // 隐藏文件
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/out/**',
      '**/build/**',
      '**/target/**',
      '**/__pycache__/**',
    ],
    ignoreInitial: true,
    persistent: true,
    depth: 20,
  })

  watcher.on('all', (event: string, filePath: string) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.FS_DIR_CHANGED, { event, filePath })
    }
  })

  watchers.set(rootPath, watcher)
}

export function unwatchProject(rootPath: string): void {
  const watcher = watchers.get(rootPath)
  if (watcher) {
    watcher.close()
    watchers.delete(rootPath)
  }
}

export function unwatchAll(): void {
  for (const [rootPath, watcher] of watchers) {
    watcher.close()
  }
  watchers.clear()
}
