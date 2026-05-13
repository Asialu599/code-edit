import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { IPC, TerminalProxyConfig } from '../shared/types'
import { execFileSync } from 'child_process'
import net from 'net'

// ---- Windows 注册表工具：读取 REG_SZ / REG_EXPAND_SZ 值 ----
function readRegString(key: string, valueName: string): string {
  try {
    const output = execFileSync('reg', ['query', key, '/v', valueName], {
      encoding: 'utf8',
      windowsHide: true,
    })
    const match = output.match(new RegExp(`${valueName}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+)`, 'i'))
    return (match?.[1] || '').trim()
  } catch {
    return ''
  }
}

// ---- 每次创建终端时从注册表获取最新 PATH（解决 Electron 环境快照过期问题） ----
function getWindowsCurrentPath(): string {
  if (process.platform !== 'win32') return process.env.PATH || ''

  const systemPath = readRegString('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', 'Path')
  const userPath = readRegString('HKCU\\Environment', 'Path')
  const merged = [systemPath, userPath].filter(Boolean).join(';')
  return merged || process.env.PATH || ''
}

interface TerminalProcess {
  id: string
  ptyProcess: pty.IPty
  projectId: string
  cwd: string
  windowId: number
}

class TerminalManager {
  private terminals = new Map<string, TerminalProcess>()
  private proxyConfig: TerminalProxyConfig = { enabled: false, address: '' }

  async setProxy(config: TerminalProxyConfig): Promise<TerminalProxyConfig> {
    if (!config.enabled) {
      this.proxyConfig = { enabled: false, address: config.address.trim() }
      this.applyProxyToAllTerminals()
      return this.proxyConfig
    }

    const requestedAddress = normalizeProxyAddress(config.address)
    const systemAddress = getSystemProxyAddress()
    let effectiveAddress = requestedAddress || systemAddress

    if (effectiveAddress && !(await canConnectToProxy(effectiveAddress)) && systemAddress) {
      effectiveAddress = systemAddress
    }

    this.proxyConfig = {
      enabled: Boolean(effectiveAddress),
      address: effectiveAddress,
    }

    this.applyProxyToAllTerminals()
    return this.proxyConfig
  }

  private applyProxyToAllTerminals(): void {
    for (const terminal of this.terminals.values()) {
      this.applyProxyToTerminal(terminal.ptyProcess)
    }
  }

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
      env: this.createEnv(),
    })

    // 修复 Windows 上 PTY 的初始目录显示
    if (process.platform === 'win32') {
      ptyProcess.write('cd /d "' + cwd + '"\r')
      ptyProcess.write('cls\r')
    }

    if (this.proxyConfig.enabled) {
      this.applyProxyToTerminal(ptyProcess)
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

  private createEnv(): Record<string, string> {
    const env = {
      ...(process.env as Record<string, string>),
      TERM: 'xterm-256color',
    }

    // Windows：每次创建终端时从注册表刷新 PATH，确保 deepseek/codex 等新安装的命令立即可用
    if (process.platform === 'win32') {
      const currentPath = getWindowsCurrentPath()
      if (currentPath) {
        env.Path = currentPath
      }
    }

    if (this.proxyConfig.enabled) {
      const proxyUrl = this.getProxyUrl()
      env.HTTP_PROXY = proxyUrl
      env.HTTPS_PROXY = proxyUrl
      env.ALL_PROXY = proxyUrl
      env.http_proxy = proxyUrl
      env.https_proxy = proxyUrl
      env.all_proxy = proxyUrl
    }

    return env
  }

  private getProxyUrl(): string {
    return `http://${this.proxyConfig.address}`
  }

  private applyProxyToTerminal(ptyProcess: pty.IPty): void {
    if (process.platform === 'win32') {
      if (this.proxyConfig.enabled) {
        const proxyUrl = this.getProxyUrl()
        ptyProcess.write(`set HTTP_PROXY=${proxyUrl}\r`)
        ptyProcess.write(`set HTTPS_PROXY=${proxyUrl}\r`)
        ptyProcess.write(`set ALL_PROXY=${proxyUrl}\r`)
        ptyProcess.write(`set http_proxy=${proxyUrl}\r`)
        ptyProcess.write(`set https_proxy=${proxyUrl}\r`)
        ptyProcess.write(`set all_proxy=${proxyUrl}\r`)
      } else {
        ptyProcess.write('set HTTP_PROXY=\r')
        ptyProcess.write('set HTTPS_PROXY=\r')
        ptyProcess.write('set ALL_PROXY=\r')
        ptyProcess.write('set http_proxy=\r')
        ptyProcess.write('set https_proxy=\r')
        ptyProcess.write('set all_proxy=\r')
      }
      return
    }

    if (this.proxyConfig.enabled) {
      const proxyUrl = this.getProxyUrl().replace(/'/g, `'\\''`)
      ptyProcess.write(`export HTTP_PROXY='${proxyUrl}' HTTPS_PROXY='${proxyUrl}' ALL_PROXY='${proxyUrl}' http_proxy='${proxyUrl}' https_proxy='${proxyUrl}' all_proxy='${proxyUrl}'\n`)
    } else {
      ptyProcess.write('unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy\n')
    }
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

function normalizeProxyAddress(address: string): string {
  const trimmed = address.trim()
  if (!trimmed) return ''

  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^socks5?:\/\//i, '')
    .split('/')[0]
}

function pickProxyServer(proxyServer: string): string {
  const value = proxyServer.trim()
  if (!value) return ''

  if (!value.includes(';')) {
    return normalizeProxyAddress(value)
  }

  const entries = value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [scheme, server] = entry.split('=')
      return { scheme: scheme.toLowerCase(), server: normalizeProxyAddress(server || '') }
    })

  return (
    entries.find((entry) => entry.scheme === 'https')?.server ||
    entries.find((entry) => entry.scheme === 'http')?.server ||
    entries[0]?.server ||
    ''
  )
}

export function getSystemProxyAddress(): string {
  if (process.platform !== 'win32') {
    return normalizeProxyAddress(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '')
  }

  try {
    const output = execFileSync('reg', [
      'query',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
      '/v',
      'ProxyEnable',
    ], { encoding: 'utf8' })

    if (!/ProxyEnable\s+REG_DWORD\s+0x1/i.test(output)) return ''

    const serverOutput = execFileSync('reg', [
      'query',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
      '/v',
      'ProxyServer',
    ], { encoding: 'utf8' })
    const match = serverOutput.match(/ProxyServer\s+REG_SZ\s+(.+)/i)

    return pickProxyServer(match?.[1] || '')
  } catch {
    return ''
  }
}

function canConnectToProxy(address: string): Promise<boolean> {
  const match = normalizeProxyAddress(address).match(/^(.+):(\d{1,5})$/)
  if (!match) return Promise.resolve(false)

  const host = match[1]
  const port = Number(match[2])
  if (!host || port < 1 || port > 65535) return Promise.resolve(false)

  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const done = (ok: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }

    socket.setTimeout(900)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

export const terminalManager = new TerminalManager()
