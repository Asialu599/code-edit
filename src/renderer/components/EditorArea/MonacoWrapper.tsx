import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { registerEnhancedJavaLanguage } from '../../languages/enhancedJava'
import { registerCodeEditMonacoThemes } from '../../themes/monacoThemes'

interface Props {
  filePath: string
  language: string
}

export default function MonacoWrapper({ filePath, language }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const content = useAppStore((s) => s.fileContents[filePath] || '')
  const updateFileContent = useAppStore((s) => s.updateFileContent)
  const markTabDirty = useAppStore((s) => s.markTabDirty)
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    let disposed = false

    // 动态 import Monaco
    import('monaco-editor/esm/vs/editor/editor.api').then((monaco) => {
      if (disposed || !containerRef.current) return

      registerCodeEditMonacoThemes(monaco)
      registerEnhancedJavaLanguage(monaco)
      const modelUri = monaco.Uri.file(filePath)
      const existingModel = monaco.editor.getModel(modelUri)
      const model = existingModel || monaco.editor.createModel(content, language, modelUri)
      monaco.editor.setModelLanguage(model, language)

      const editor = monaco.editor.create(containerRef.current, {
        model,
        theme: theme === 'light' ? 'code-edit-light' : 'code-edit-dark',
        automaticLayout: true,
        minimap: { enabled: true, maxColumn: 80, showSlider: 'mouseover' },
        scrollBeyondLastLine: false,
        fontSize: 14,
        fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
        lineHeight: 22,
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'off',
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
      })

      // 文件变更监听
      editor.onDidChangeModelContent(() => {
        const newValue = editor.getValue()
        updateFileContent(filePath, newValue)
        markTabDirty(filePath, newValue !== content)
      })

      // Ctrl+S 保存
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        async () => {
          const val = editor.getValue()
          await window.electronAPI.writeFile(filePath, val)
          markTabDirty(filePath, false)
        }
      )

      editorRef.current = editor
    })

    return () => {
      disposed = true
      if (editorRef.current) {
        editorRef.current.dispose()
        editorRef.current = null
      }
    }
  }, [filePath, theme]) // 切换文件或主题时重建

  // 当 FileTree 打开其他文件时，检测文件重置
  useEffect(() => {
    if (editorRef.current) {
      const currentVal = editorRef.current.getValue()
      if (currentVal !== content) {
        editorRef.current.setValue(content)
        markTabDirty(filePath, false)
      }
    }
  }, [filePath, content])

  return <div ref={containerRef} className="monaco-container" />
}
