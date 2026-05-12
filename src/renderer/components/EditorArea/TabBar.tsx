import { useAppStore } from '../../store/useAppStore'

export default function TabBar() {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const closeTab = useAppStore((s) => s.closeTab)

  if (openTabs.length === 0) return null

  return (
    <div className="tab-bar">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-label">
            {tab.isDirty && <span className="tab-dirty">●</span>}
            {tab.fileName}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab.id)
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
