import { useAppStore } from '../../store/useAppStore'

export default function StatusBar() {
  const { openTabs, activeTabId, bottomPanelVisible, toggleBottomPanel, projects } = useAppStore()
  const activeTab = openTabs.find((t) => t.id === activeTabId)

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {activeTab ? (
          <>
            <span className="status-item">{activeTab.filePath}</span>
          </>
        ) : (
          <span className="status-item">就绪</span>
        )}
      </div>
      <div className="status-bar-right">
        {activeTab && (
          <>
            <span className="status-item">{activeTab.language}</span>
            <span className="status-item">UTF-8</span>
          </>
        )}
        <span className="status-item">
          项目: {projects.length}
        </span>
        <button className="status-action" onClick={toggleBottomPanel}>
          终端: {bottomPanelVisible ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
