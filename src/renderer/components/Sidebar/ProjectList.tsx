import { useAppStore } from '../../store/useAppStore'
import ProjectItem from './ProjectItem'

export default function ProjectList() {
  const projects = useAppStore((s) => s.projects)
  const addProject = useAppStore((s) => s.addProject)
  const removeProject = useAppStore((s) => s.removeProject)
  const toggleProjectExpand = useAppStore((s) => s.toggleProjectExpand)
  const fileTrees = useAppStore((s) => s.fileTrees)
  const loadFileTree = useAppStore((s) => s.loadFileTree)
  const openFile = useAppStore((s) => s.openFile)
  const toggleBottomPanel = useAppStore((s) => s.toggleBottomPanel)
  const bottomPanelVisible = useAppStore((s) => s.bottomPanelVisible)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const bottomPanelHeight = useAppStore((s) => s.bottomPanelHeight)
  const setBottomPanelHeight = useAppStore((s) => s.setBottomPanelHeight)

  const handleAddProject = async () => {
    const folderPath = await window.electronAPI.openFolderDialog()
    if (folderPath) {
      await addProject(folderPath)
    }
  }

  return (
    <div className="project-list">
      {projects.map((project) => (
        <ProjectItem
          key={project.id}
          project={project}
          fileNodes={fileTrees[project.rootPath] || []}
          onToggleExpand={() => toggleProjectExpand(project.id)}
          onRemove={() => removeProject(project.id)}
          onLoadChildren={(dirPath) => loadFileTree(dirPath)}
          onOpenFile={(filePath) => openFile(filePath)}
          onOpenTerminal={async (cwd) => {
            try {
              const termId = await window.electronAPI.createTerminal(project.id, cwd)
              addTerminal({ id: termId, projectId: project.id, cwd, title: `终端 - ${project.name}` })
            } catch (err: any) {
              alert('终端创建失败: ' + (err.message || err))
            }
          }}
        />
      ))}
      <div className="sidebar-actions">
        <button className="sidebar-action-btn" onClick={handleAddProject} title="添加项目文件夹">
          + 添加项目
        </button>
        <button
          className="sidebar-action-btn"
          onClick={toggleBottomPanel}
          title="切换终端面板"
        >
          {bottomPanelVisible ? '隐藏终端' : '显示终端'}
        </button>
      </div>
    </div>
  )
}
