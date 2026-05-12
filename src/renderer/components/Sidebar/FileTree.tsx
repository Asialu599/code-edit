import { useState } from 'react'
import { FileNode } from '../../../shared/types'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  node: FileNode
  depth: number
  onLoadChildren: (dirPath: string) => Promise<void>
  onOpenFile: (filePath: string) => void
  onOpenTerminal: (cwd: string) => void
}

export default function FileTree({ node, depth, onLoadChildren, onOpenFile, onOpenTerminal }: Props) {
  const [expanded, setExpanded] = useState(node.expanded || false)
  // 从 store 读取该目录的实际子节点（懒加载后会存放这里）
  const storeChildren = useAppStore((s) => s.fileTrees[node.path])
  const children = storeChildren || node.children

  const handleToggle = async () => {
    if (!node.isDirectory) return
    if (!expanded) {
      // 如果 store 里还没有该目录的数据，触发懒加载
      if (!storeChildren || storeChildren.length === 0) {
        await onLoadChildren(node.path)
      }
    }
    setExpanded(!expanded)
  }

  const paddingLeft = 12 + depth * 16

  return (
    <div className="file-tree">
      <div
        className={`file-tree-item ${node.isDirectory ? 'is-directory' : 'is-file'}`}
        style={{ paddingLeft }}
        onClick={() => {
          if (node.isDirectory) {
            handleToggle()
          } else {
            onOpenFile(node.path)
          }
        }}
        onContextMenu={(e) => {
          if (node.isDirectory) {
            e.preventDefault()
            window.electronAPI.openPath(node.path)
          }
        }}
        title={node.isDirectory ? `${node.path}（右键 → 在资源管理器打开）` : node.path}
      >
        <span
          className={`file-icon ${node.isDirectory ? 'file-icon-dir' : 'file-icon-file'}`}
          aria-hidden="true"
        />
        <span className="file-name">{node.name}</span>
      </div>
      {expanded && children && children.length > 0 && (
        <div className="file-tree-children">
          {children.map((child) => (
            <FileTree
              key={child.path}
              node={child}
              depth={depth + 1}
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
