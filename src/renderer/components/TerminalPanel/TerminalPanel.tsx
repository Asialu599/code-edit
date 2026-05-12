import { useAppStore } from '../../store/useAppStore'
import XtermWrapper from './XtermWrapper'

export default function TerminalPanel() {
  const terminals = useAppStore((s) => s.terminals)
  const activeTerminalId = useAppStore((s) => s.activeTerminalId)
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal)
  const removeTerminal = useAppStore((s) => s.removeTerminal)
  const projects = useAppStore((s) => s.projects)
  const bottomPanelHeight = useAppStore((s) => s.bottomPanelHeight)
  const paneCount = Math.max(terminals.length, 1)
  const gridColumns = terminals.length >= 5 ? Math.ceil(paneCount / 2) : paneCount
  const gridRows = terminals.length >= 5 ? 2 : 1

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
          height: bottomPanelHeight - 35,
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
