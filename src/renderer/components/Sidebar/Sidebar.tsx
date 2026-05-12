import { useEffect, useState } from 'react'
import { FileSearchResult } from '../../../shared/types'
import { useAppStore } from '../../store/useAppStore'
import ProjectList from './ProjectList'

export default function Sidebar() {
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const projects = useAppStore((s) => s.projects)
  const openFile = useAppStore((s) => s.openFile)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const trimmedQuery = searchQuery.trim()

  useEffect(() => {
    let cancelled = false

    if (!trimmedQuery) {
      setSearchResults([])
      setSearching(false)
      return
    }

    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const results = await window.electronAPI.searchFiles(
          projects.map((p) => ({ name: p.name, rootPath: p.rootPath })),
          trimmedQuery
        )

        if (!cancelled) {
          setSearchResults(results)
        }
      } catch (err) {
        console.error('[Sidebar] search files failed:', err)
        if (!cancelled) {
          setSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setSearching(false)
        }
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [projects, trimmedQuery])

  return (
    <div className="sidebar" style={{ width: sidebarWidth }}>
      <div className="sidebar-header">
        <span className="sidebar-title">EXPLORER</span>
        <input
          className="sidebar-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索文件名"
          spellCheck={false}
        />
      </div>
      <div className="sidebar-content">
        {trimmedQuery ? (
          <div className="search-results">
            <div className="search-results-meta">
              {searching ? '搜索中...' : `找到 ${searchResults.length} 个文件`}
            </div>
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <button
                  key={result.path}
                  className="search-result-item"
                  onClick={() => openFile(result.path)}
                  title={result.path}
                >
                  <span className="search-result-name">{result.name}</span>
                  <span className="search-result-path">
                    {result.projectName} · {result.path.slice(result.projectRoot.length).replace(/^[\\/]/, '')}
                  </span>
                </button>
              ))
            ) : (
              !searching && (
                <div className="search-empty">没有匹配的文件名</div>
              )
            )}
          </div>
        ) : (
          <>
            {projects.length === 0 && (
          <div className="sidebar-empty">
            <p>尚未打开项目</p>
            <p className="hint">点击下方 "+" 添加项目文件夹</p>
          </div>
            )}
            <ProjectList />
          </>
        )}
      </div>
    </div>
  )
}
