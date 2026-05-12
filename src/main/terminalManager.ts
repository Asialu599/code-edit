import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { IPC } from '../shared/types'

interface TerminalProcess {
  id: string
  ptyProcess: pty.IPty
  projectId: string
  cwd: string
  windowId: number
}

class TerminalManager {
  private terminals = new Map<string, TerminalProcess>()

  create(window: BrowserWindow, projectId: string, cwd: string): string {
    const id = crypto.randomUUID()
    const shell = process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/bash')

    // Windows 上 node-pty 要求正斜杠路径
    const normalizedCwd = process.platform === 'win32'
      ? cwd.replace(/\\/g, '/')
      : cwd

    const args = process.platform === 'win32' ? [] : []

    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: normalizedCwd,
      env: {
        ...(process.env as Record<string, string>),
        TERM: 'xterm-256color',
      },
    })

    // 修复 Windows 上 PTY 的初始目录显示
    if (process.platform === 'win32') {
      ptyProcess.write('cd /d "' + cwd + '"\r')
      ptyProcess.write('cls\r')
    }

    ptyProcess.onData((data: string) => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.TERMINAL_DATA, { id, data })
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.TERMINAL_EXIT, { id, exitCode })
      }
      this.terminals.delete(id)
    })

    this.terminals.set(id, { id, ptyProcess, projectId, cwd, windowId: window.id })
    return id
  }

  write(id: string, data: string): void {
    const t = this.terminals.get(id)
    if (!t) {
      console.warn('[TerminalManager] write ignored, terminal not found:', id)
      return
    }

    try {
      t.ptyProcess.write(data)
    } catch (err) {
      console.error('[TerminalManager] write failed:', err)
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const t = this.terminals.get(id)
    if (!t) return

    try {
      t.ptyProcess.resize(cols, rows)
    } catch (err) {
      console.error('[TerminalManager] resize failed:', err)
    }
  }

  kill(id: string): void {
    const t = this.terminals.get(id)
    if (t) {
      t.ptyProcess.kill()
      this.terminals.delete(id)
    }
  }

  disposeForWindow(windowId: number): void {
    for (const [id, t] of this.terminals) {
      if (t.windowId === windowId) {
        t.ptyProcess.kill()
        this.terminals.delete(id)
      }
    }
  }
}

export const terminalManager = new TerminalManager()
