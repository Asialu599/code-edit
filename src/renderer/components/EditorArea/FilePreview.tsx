import { EditorTab } from '../../../shared/types'

function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return `file:///${encodeURI(normalized)}`
}

interface Props {
  tab: EditorTab
}

export default function FilePreview({ tab }: Props) {
  const fileUrl = toFileUrl(tab.filePath)

  if (tab.kind === 'image') {
    return (
      <div className="file-preview image-preview">
        <div className="file-preview-toolbar">
          <span>{tab.fileName}</span>
          <button onClick={() => window.electronAPI.openPath(tab.filePath)}>
            系统打开
          </button>
        </div>
        <div className="image-preview-stage">
          <img src={fileUrl} alt={tab.fileName} />
        </div>
      </div>
    )
  }

  if (tab.kind === 'pdf') {
    return (
      <div className="file-preview pdf-preview">
        <div className="file-preview-toolbar">
          <span>{tab.fileName}</span>
          <button onClick={() => window.electronAPI.openPath(tab.filePath)}>
            系统打开
          </button>
        </div>
        <iframe src={fileUrl} title={tab.fileName} />
      </div>
    )
  }

  return (
    <div className="file-preview unsupported-preview">
      <div className="unsupported-preview-card">
        <h2>{tab.fileName}</h2>
        <p>这个文件类型更适合用系统默认应用打开。</p>
        <button onClick={() => window.electronAPI.openPath(tab.filePath)}>
          系统打开
        </button>
      </div>
    </div>
  )
}
