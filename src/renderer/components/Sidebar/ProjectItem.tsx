import { Project, FileNode } from '../../../shared/types'
import FileTree from './FileTree'

interface Props {
  project: Project
  fileNodes: FileNode[]
  onToggleExpand: () => void
  onRemove: () => void
  onLoadChildren: (dirPath: string) => void
  onOpenFile: (filePath: string) => void
  onOpenTerminal: (cwd: string) => void
}

export default function ProjectItem({
  project,
  fileNodes,
  onToggleExpand,
  onRemove,
  onLoadChildren,
  onOpenFile,
  onOpenTerminal,
}: Props) {
  return (
    <div className="project-item">
      <div className="project-header">
        <div className="project-header-left" onClick={onToggleExpand}>
          <span className="toggle-icon">{project.expanded ? '▾' : '▸'}</span>
          <span className="project-icon" aria-hidden="true" />
          <span className="project-name">{project.name}</span>
        </div>
        <div className="project-header-actions">
          <button
            className="project-action-btn"
            title="在此项目中打开终端"
            onClick={(e) => {
              e.stopPropagation()
              onOpenTerminal(project.rootPath)
            }}
          >
            TERM
          </button>
          <button
            className="project-action-btn"
            title="关闭项目"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            ✕
          </button>
        </div>
      </div>
      {project.expanded && (
        <div className="project-tree">
          {fileNodes.map((node) => (
            <FileTree
              key={node.path}
              node={node}
              depth={0}
              onLoadChildren={onLoadChildren}
              onOpenFile={onOpenFile}
              onOpenTerminal={onOpenTerminal}
            />
          ))}
        </div>
      )}
    </div>
  )
}
