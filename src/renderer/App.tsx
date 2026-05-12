import { useEffect } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import EditorArea from './components/EditorArea/EditorArea'
import StatusBar from './components/StatusBar/StatusBar'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const { openTabs, activeTabId, projects, theme, toggleTheme } = useAppStore()
  const activeTab = openTabs.find((t) => t.id === activeTabId)

  // 启动时恢复上次打开的项目文件夹
  useEffect(() => {
    useAppStore.getState().restoreProjects()
  }, [])

  // 监听文件系统变更
  useEffect(() => {
    const cleanup = window.electronAPI.onDirChanged((event, filePath) => {
      const { projects: projs, refreshFileTree } = useAppStore.getState()
      for (const p of projs) {
        if (filePath.startsWith(p.rootPath)) {
          refreshFileTree(p.rootPath)
          break
        }
      }
    })
    return cleanup
  }, [])

  // 监听菜单事件
  useEffect(() => {
    const cleanups = [
      // 文件 → 打开文件夹
      window.electronAPI.onMenuOpenFolder(async (folderPath) => {
        const { addProject } = useAppStore.getState()
        await addProject(folderPath)
      }),

      // 文件 → 打开文件
      window.electronAPI.onMenuOpenFile(async (filePath) => {
        const { openFile } = useAppStore.getState()
        await openFile(filePath)
      }),

      // 文件 → 保存
      window.electronAPI.onMenuSave(async () => {
        const state = useAppStore.getState()
        const tab = state.openTabs.find((t) => t.id === state.activeTabId)
        if (tab) {
          const content = state.fileContents[tab.filePath] || ''
          await window.electronAPI.writeFile(tab.filePath, content)
          useAppStore.getState().markTabDirty(tab.filePath, false)
        }
      }),

      // 文件 → 全部保存
      window.electronAPI.onMenuSaveAll(async () => {
        const state = useAppStore.getState()
        for (const tab of state.openTabs.filter((t) => t.isDirty)) {
          const content = state.fileContents[tab.filePath] || ''
          await window.electronAPI.writeFile(tab.filePath, content)
          useAppStore.getState().markTabDirty(tab.filePath, false)
        }
      }),

      // 文件 → 关闭文件
      window.electronAPI.onMenuCloseTab(() => {
        const state = useAppStore.getState()
        if (state.activeTabId) {
          state.closeTab(state.activeTabId)
        }
      }),

      // 文件 → 关闭文件夹
      window.electronAPI.onMenuCloseProject(() => {
        const state = useAppStore.getState()
        if (state.projects.length > 0) {
          state.removeProject(state.projects[state.projects.length - 1].id)
        }
      }),

      // 视图 → 切换侧边栏
      window.electronAPI.onMenuToggleSidebar(() => {
        const state = useAppStore.getState()
        // 通过设置宽度为 0 或默认值来切换
        if (state.sidebarWidth > 0) {
          localStorage.setItem('prevSidebarWidth', String(state.sidebarWidth))
          state.setSidebarWidth(0)
        } else {
          const prev = parseInt(localStorage.getItem('prevSidebarWidth') || '260')
          state.setSidebarWidth(prev)
        }
      }),

      // 视图 → 切换终端
      window.electronAPI.onMenuToggleTerminal(() => {
        useAppStore.getState().toggleBottomPanel()
      }),

      // 终端 → 新建终端
      window.electronAPI.onMenuNewTerminal(() => {
        const state = useAppStore.getState()
        const cwd = state.projects[0]?.rootPath || 'C:\\'
        const projectId = state.projects[0]?.id || 'global'
        window.electronAPI.createTerminal(projectId, cwd).then((termId) => {
          const name = state.projects[0]?.name || '全局'
          state.addTerminal({
            id: termId,
            projectId,
            cwd,
            title: `终端 - ${name}`,
          })
        })
      }),

      // 视图 → 切换主题
      window.electronAPI.onMenuToggleTheme(() => {
        useAppStore.getState().toggleTheme()
      }),
    ]

    return () => cleanups.forEach((fn) => fn())
  }, [])

  return (
    <div className={`app app-theme-${theme}`}>
      <div className="app-chrome">
        <div className="app-chrome-title">CodeEdit</div>
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
        >
          💡
        </button>
      </div>
      <div className="app-body">
        <Sidebar />
        <EditorArea />
      </div>
      <StatusBar />
    </div>
  )
}
