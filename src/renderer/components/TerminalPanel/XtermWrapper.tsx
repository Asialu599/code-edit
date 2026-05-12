import { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  terminalId: string
}

export default function XtermWrapper({ terminalId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<any>(null)
  const removeTerminal = useAppStore((s) => s.removeTerminal)
  const activeTerminalId = useAppStore((s) => s.activeTerminalId)

  useEffect(() => {
    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let cleanupData: (() => void) | null = null
    let cleanupExit: (() => void) | null = null
    let inputDisposable: { dispose: () => void } | null = null

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
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#ffffff',
            selectionBackground: '#264f78',
          },
          allowProposedApi: true,
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

  return (
    <div
      ref={containerRef}
      className="xterm-container"
      onMouseDown={() => termRef.current?.focus()}
    />
  )
}
