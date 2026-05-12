import { useAppStore } from '../../store/useAppStore'
import TabBar from './TabBar'
import MonacoWrapper from './MonacoWrapper'
import MarkdownEditorView from './MarkdownEditorView'
import FilePreview from './FilePreview'
import WelcomeScreen from './WelcomeScreen'
import TerminalPanel from '../TerminalPanel/TerminalPanel'

export default function EditorArea() {
  const {
    openTabs,
    activeTabId,
    bottomPanelVisible,
    bottomPanelHeight,
    setBottomPanelHeight,
  } = useAppStore()
  const activeTab = openTabs.find((t) => t.id === activeTabId)

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = bottomPanelHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextHeight = startHeight + startY - moveEvent.clientY
      const maxHeight = Math.max(180, window.innerHeight - 150)
      setBottomPanelHeight(Math.min(Math.max(nextHeight, 110), maxHeight))
    }

    const handleMouseUp = () => {
      document.body.classList.remove('is-resizing-terminal')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    document.body.classList.add('is-resizing-terminal')
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className="editor-area">
      <TabBar />
      <div className="editor-main">
        {activeTab ? (
          activeTab.kind === 'image' || activeTab.kind === 'pdf' ? (
            <FilePreview key={activeTab.filePath} tab={activeTab} />
          ) : activeTab.language === 'markdown' ? (
            <MarkdownEditorView
              key={activeTab.filePath}
              filePath={activeTab.filePath}
              language={activeTab.language}
            />
          ) : (
            <MonacoWrapper
              key={activeTab.filePath}
              filePath={activeTab.filePath}
              language={activeTab.language}
            />
          )
        ) : (
          <WelcomeScreen />
        )}
      </div>
      {bottomPanelVisible && (
        <>
        <div
          className="terminal-resize-handle"
          onMouseDown={handleResizeStart}
          title="拖动调整终端高度"
        />
        <div className="bottom-panel" style={{ height: bottomPanelHeight }}>
          <TerminalPanel />
        </div>
        </>
      )}
    </div>
  )
}
