import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import MarkdownPreview from './MarkdownPreview'
import MonacoWrapper from './MonacoWrapper'

type MarkdownMode = 'edit' | 'split' | 'preview'

interface Props {
  filePath: string
  language: string
}

export default function MarkdownEditorView({ filePath, language }: Props) {
  const [mode, setMode] = useState<MarkdownMode>('split')
  const content = useAppStore((s) => s.fileContents[filePath] || '')

  return (
    <div className="markdown-workspace">
      <div className="markdown-mode-switcher" aria-label="Markdown 查看模式">
        <button
          className={`markdown-mode-btn ${mode === 'edit' ? 'active' : ''}`}
          onClick={() => setMode('edit')}
          title="编辑器模式"
        >
          <span className="mode-icon mode-icon-edit" />
        </button>
        <button
          className={`markdown-mode-btn ${mode === 'split' ? 'active' : ''}`}
          onClick={() => setMode('split')}
          title="编辑器和预览模式"
        >
          <span className="mode-icon mode-icon-split" />
        </button>
        <button
          className={`markdown-mode-btn ${mode === 'preview' ? 'active' : ''}`}
          onClick={() => setMode('preview')}
          title="预览模式"
        >
          <span className="mode-icon mode-icon-preview" />
        </button>
      </div>

      <div className={`markdown-layout markdown-layout-${mode}`}>
        {mode !== 'preview' && (
          <div className="markdown-editor-pane">
            <MonacoWrapper filePath={filePath} language={language} />
          </div>
        )}
        {mode !== 'edit' && (
          <div className="markdown-preview-pane">
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>
    </div>
  )
}
