import { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  terminalId: string
}

const xtermThemes = {
  dark: {
    background: '#0d1116',
    foreground: '#d5dbe3',
    cursor: '#f0f4f8',
    cursorAccent: '#0d1116',
    selectionBackground: '#264f78',
    black: '#0d1116',
    red: '#ff6b6b',
    green: '#14d6a7',
    yellow: '#f6c85f',
    blue: '#4fb3ff',
    magenta: '#d78cff',
    cyan: '#7cc7ff',
    white: '#d5dbe3',
    brightBlack: '#65717e',
    brightRed: '#ff8a8a',
    brightGreen: '#5ee6c2',
    brightYellow: '#ffd983',
    brightBlue: '#7cc7ff',
    brightMagenta: '#e6b0ff',
    brightCyan: '#a6e2ff',
    brightWhite: '#f0f4f8',
  },
  light: {
    background: '#fbfdff',
    foreground: '#26313d',
    cursor: '#101820',
    cursorAccent: '#fbfdff',
    selectionBackground: '#c7e5ff',
    black: '#26313d',
    red: '#c73636',
    green: '#008a64',
    yellow: '#9b6a00',
    blue: '#006fbf',
    magenta: '#8d45b7',
    cyan: '#007a99',
    white: '#eef2f5',
    brightBlack: '#7d8b98',
    brightRed: '#d94b4b',
    brightGreen: '#00a878',
    brightYellow: '#b88400',
    brightBlue: '#1688dd',
    brightMagenta: '#a45bc8',
    brightCyan: '#0090b5',
    brightWhite: '#ffffff',
  },
} as const

const PASTE_COOLDOWN_MS = 1200

export default function XtermWrapper({ terminalId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<any>(null)
  const lastCtrlCAtRef = useRef(0)
  const lastCtrlVAtRef = useRef(0)
  const ctrlVDownRef = useRef(false)
  const removeTerminal = useAppStore((s) => s.removeTerminal)
  const activeTerminalId = useAppStore((s) => s.activeTerminalId)
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let cleanupData: (() => void) | null = null
    let cleanupExit: (() => void) | null = null
    let inputDisposable: { dispose: () => void } | null = null
    let terminalElement: HTMLDivElement | null = null

    const stopShortcutEvent = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()

      if ('stopImmediatePropagation' in event) {
        event.stopImmediatePropagation()
      }
    }

    const pasteClipboardOnce = (): void => {
      const now = Date.now()
      if (now - lastCtrlVAtRef.current <= PASTE_COOLDOWN_MS) return

      lastCtrlVAtRef.current = now
      const text = window.electronAPI.readClipboardText()
      if (text) {
        window.electronAPI.writeTerminal(terminalId, text)
      }
    }

    const handleTerminalKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'v') {
        return
      }

      stopShortcutEvent(event)
      if (event.repeat || ctrlVDownRef.current) return

      ctrlVDownRef.current = true
      pasteClipboardOnce()
    }

    const handleTerminalKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'v') {
        ctrlVDownRef.current = false
      }
    }

    const handleTerminalPaste = (event: ClipboardEvent) => {
      stopShortcutEvent(event)
      pasteClipboardOnce()
    }

    const init = async () => {
      try {
        console.log('[Xterm] loading @xterm packages...')
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
        ])
        console.log('[Xterm] packages loaded, Terminal:', typeof Terminal)

        if (disposed || !containerRef.current) {
          console.log('[Xterm] disposed or no container, aborting')
          return
        }

        const term = new Terminal({
          fontSize: 14,
          fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
          cursorBlink: true,
          cursorStyle: 'bar',
          theme: xtermThemes[useAppStore.getState().theme],
          allowProposedApi: true,
        })

        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          if (event.type === 'keyup' && event.key.toLowerCase() === 'v') {
            ctrlVDownRef.current = false
            return false
          }

          if (event.type !== 'keydown' || !event.ctrlKey || event.altKey || event.metaKey) {
            return true
          }

          const key = event.key.toLowerCase()

          if (key === 'c') {
            if (term.hasSelection()) {
              const selectedText = term.getSelection()
              if (selectedText) {
                window.electronAPI.writeClipboardText(selectedText)
                term.clearSelection()
              }
              return false
            }

            const now = Date.now()
            const isDoubleCtrlC = now - lastCtrlCAtRef.current <= 700
            lastCtrlCAtRef.current = now

            if (isDoubleCtrlC) {
              window.electronAPI.writeTerminal(terminalId, '\x03')
            }

            return false
          }

          if (key === 'v') {
            stopShortcutEvent(event)
            if (!event.repeat && !ctrlVDownRef.current) {
              ctrlVDownRef.current = true
              pasteClipboardOnce()
            }
            return false
          }

          return true
        })

        console.log('[Xterm] Terminal instance created')

        // 尝试 WebGL 渲染
        try {
          const { WebglAddon } = await import('@xterm/addon-webgl')
          term.loadAddon(new WebglAddon())
          console.log('[Xterm] WebGL addon loaded')
        } catch {
          console.log('[Xterm] WebGL not available, using DOM renderer')
        }

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        term.open(containerRef.current)
        terminalElement = containerRef.current
        terminalElement.addEventListener('keydown', handleTerminalKeyDown, true)
        terminalElement.addEventListener('keyup', handleTerminalKeyUp, true)
        terminalElement.addEventListener('paste', handleTerminalPaste, true)
        console.log('[Xterm] terminal opened in container')

        // ResizeObserver 自动适应容器大小
        const fitAndResize = () => {
          try {
            fitAddon.fit()
            window.electronAPI.resizeTerminal(terminalId, term.cols, term.rows)
          } catch {}
        }

        resizeObserver = new ResizeObserver(() => {
          fitAndResize()
        })
        resizeObserver.observe(containerRef.current)

        // 延迟 fit 确保初始渲染后尺寸正确
        setTimeout(() => {
          if (!disposed) {
            fitAndResize()
            if (activeTerminalId === terminalId) {
              term.focus()
            }
          }
        }, 100)

        // 用户输入 → PTY
        inputDisposable = term.onData((data: string) => {
          window.electronAPI.writeTerminal(terminalId, data)
        })

        // PTY 输出 → 终端
        cleanupData = window.electronAPI.onTerminalData(({ id, data }) => {
          if (id === terminalId && !disposed) {
            term.write(data)
          }
        })

        // PTY 退出
        cleanupExit = window.electronAPI.onTerminalExit(({ id }) => {
          if (id === terminalId) {
            removeTerminal(terminalId)
          }
        })

        console.log('[Xterm] terminal ready, id:', terminalId)
        termRef.current = term
      } catch (err: any) {
        console.error('[Xterm] init error:', err.message, err.stack)
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div style="color:#f44747;padding:12px;font-family:monospace;">
            终端加载失败: ${err.message}<br/>
            <small>请按 F12 查看控制台详情</small>
          </div>`
        }
      }
    }

    init()

    return () => {
      disposed = true
      inputDisposable?.dispose()
      cleanupData?.()
      cleanupExit?.()
      resizeObserver?.disconnect()
      terminalElement?.removeEventListener('keydown', handleTerminalKeyDown, true)
      terminalElement?.removeEventListener('keyup', handleTerminalKeyUp, true)
      terminalElement?.removeEventListener('paste', handleTerminalPaste, true)
      if (termRef.current) {
        termRef.current.dispose()
        termRef.current = null
      }
    }
  }, [terminalId])

  useEffect(() => {
    if (activeTerminalId === terminalId) {
      termRef.current?.focus()
    }
  }, [activeTerminalId, terminalId])

  useEffect(() => {
    const term = termRef.current
    if (!term) return

    term.options.theme = xtermThemes[theme]
    try {
      term.refresh(0, term.rows - 1)
    } catch {}
  }, [theme])

  return (
    <div
      ref={containerRef}
      className="xterm-container"
      onMouseDown={() => termRef.current?.focus()}
    />
  )
}
