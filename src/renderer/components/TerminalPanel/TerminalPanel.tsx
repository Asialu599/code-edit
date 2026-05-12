import { useAppStore } from '../../store/useAppStore'
import XtermWrapper from './XtermWrapper'

export default function TerminalPanel() {
  const terminals = useAppStore((s) => s.terminals)
  const activeTerminalId = useAppStore((s) => s.activeTerminalId)
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal)
  const removeTerminal = useAppStore((s) => s.removeTerminal)
  const projects = useAppStore((s) => s.projects)
  const bottomPanelHeight = useAppStore((s) => s.bottomPanelHeight)
  const terminalProxy = useAppStore((s) => s.terminalProxy)
  const setTerminalProxyAddress = useAppStore((s) => s.setTerminalProxyAddress)
  const enableTerminalProxy = useAppStore((s) => s.enableTerminalProxy)
  const disableTerminalProxy = useAppStore((s) => s.disableTerminalProxy)
  const paneCount = Math.max(terminals.length, 1)
  const gridColumns = terminals.length >= 5 ? Math.ceil(paneCount / 2) : paneCount
  const gridRows = terminals.length >= 5 ? 2 : 1

  const validateProxyAddress = (address: string): boolean => {
    const match = address.trim().match(/^([a-zA-Z0-9.-]+):(\d{1,5})$/)
    if (!match) return false
    const port = Number(match[2])
    return port > 0 && port <= 65535
  }

  const handleNewTerminal = async () => {
    try {
      const cwd = projects[0]?.rootPath || 'C:\\'
      const projectId = projects[0]?.id || 'global'
      const termId = await window.electronAPI.createTerminal(projectId, cwd)
      useAppStore.getState().addTerminal({
        id: termId,
        projectId,
        cwd,
        title: `终端 ${terminals.length + 1}`,
      })
    } catch (err: any) {
      alert('终端创建失败: ' + (err.message || err))
    }
  }

  const handleCloseTerminal = (id: string) => {
    window.electronAPI.killTerminal(id)
    removeTerminal(id)
  }

  const handleEnableProxy = async () => {
    if (!validateProxyAddress(terminalProxy.address)) {
      alert('代理格式不正确，请输入类似 127.0.0.1:6922 的地址')
      return
    }

    try {
      await enableTerminalProxy()
    } catch (err: any) {
      alert('启用代理失败: ' + (err.message || err))
    }
  }

  const handleDisableProxy = async () => {
    try {
      await disableTerminalProxy()
    } catch (err: any) {
      alert('停用代理失败: ' + (err.message || err))
    }
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-toolbar">
        <div className="terminal-tabs">
          {terminals.map((t) => (
            <div
              key={t.id}
              className={`terminal-tab ${t.id === activeTerminalId ? 'active' : ''}`}
              onClick={() => setActiveTerminal(t.id)}
            >
              <span>{t.title}</span>
              <button
                className="terminal-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseTerminal(t.id)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="terminal-toolbar-actions">
          <div className={`terminal-proxy-control ${terminalProxy.enabled ? 'enabled' : ''}`}>
            <input
              className="terminal-proxy-input"
              value={terminalProxy.address}
              onChange={(e) => setTerminalProxyAddress(e.target.value)}
              placeholder="127.0.0.1:6922"
              title="代理地址，格式如 127.0.0.1:6922"
            />
            {terminalProxy.enabled ? (
              <button className="terminal-action-btn proxy-toggle active" onClick={handleDisableProxy}>
                停用代理
              </button>
            ) : (
              <button className="terminal-action-btn proxy-toggle" onClick={handleEnableProxy}>
                启用代理
              </button>
            )}
          </div>
          {terminals.length === 0 && (
            <button className="terminal-action-btn" onClick={handleNewTerminal}>
              + 新建终端
            </button>
          )}
          {terminals.length > 0 && (
            <button className="terminal-action-btn" onClick={handleNewTerminal} title="新建终端">
              +
            </button>
          )}
        </div>
      </div>
      <div
        className="terminal-container terminal-grid"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(260px, 1fr))`,
          gridTemplateRows: `repeat(${gridRows}, minmax(140px, 1fr))`,
        }}
      >
        {terminals.length > 0 ? (
          terminals.map((terminal, index) => (
            <div
              key={terminal.id}
              className={`terminal-pane ${terminal.id === activeTerminalId ? 'active' : ''}`}
              onMouseDown={() => setActiveTerminal(terminal.id)}
            >
              <div className="terminal-pane-header">
                <span className="terminal-pane-index">{index + 1}</span>
                <span className="terminal-pane-title">{terminal.title}</span>
                <button
                  className="terminal-pane-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseTerminal(terminal.id)
                  }}
                  title="关闭终端"
                >
                  ✕
                </button>
              </div>
              <div className="terminal-pane-body">
                <XtermWrapper terminalId={terminal.id} />
              </div>
            </div>
          ))
        ) : (
          <div className="terminal-empty">
            <span>点击 "+" 新建终端</span>
          </div>
        )}
      </div>
    </div>
  )
}
