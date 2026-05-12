import { create } from 'zustand'
import { Project, FileNode, EditorTab, TerminalInfo } from '../../shared/types'
import { detectLanguage } from '../../shared/languageMap'
import {
  SIDEBAR_DEFAULT_WIDTH,
  BOTTOM_PANEL_DEFAULT_HEIGHT,
  APP_NAME,
} from '../../shared/constants'

const OPEN_PROJECTS_STORAGE_KEY = 'code-edit.openProjects'
const THEME_STORAGE_KEY = 'code-edit.theme'

export type AppTheme = 'dark' | 'light'

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.avif',
])

const EXTERNAL_EXTENSIONS = new Set([
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.exe', '.dll', '.bin',
])

function normalizeProjectPath(rootPath: string): string {
  return rootPath.replace(/[\\/]+$/, '').toLowerCase()
}

function saveOpenProjectPaths(projects: Project[]): void {
  const paths = projects.map((p) => p.rootPath)
  localStorage.setItem(OPEN_PROJECTS_STORAGE_KEY, JSON.stringify(paths))
}

function readOpenProjectPaths(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_PROJECTS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
  } catch {
    return []
  }
}

function getFileExtension(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() || ''
  return name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : ''
}

function getTabKind(filePath: string) {
  const ext = getFileExtension(filePath)
  if (IMAGE_EXTENSIONS.has(ext)) return 'image' as const
  if (ext === '.pdf') return 'pdf' as const
  if (EXTERNAL_EXTENSIONS.has(ext)) return 'external' as const
  return 'text' as const
}

interface AppState {
  // 项目
  projects: Project[]
  restoreProjects: () => Promise<void>
  addProject: (rootPath: string) => Promise<void>
  removeProject: (id: string) => void
  toggleProjectExpand: (id: string) => void

  // 文件树 (key: dirPath)
  fileTrees: Record<string, FileNode[]>
  loadFileTree: (dirPath: string) => Promise<void>
  refreshFileTree: (rootPath: string) => Promise<void>

  // 编辑器标签
  openTabs: EditorTab[]
  activeTabId: string | null
  fileContents: Record<string, string>
  openFile: (filePath: string) => Promise<void>
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateFileContent: (filePath: string, content: string) => void
  markTabDirty: (filePath: string, dirty: boolean) => void

  // 终端
  terminals: TerminalInfo[]
  activeTerminalId: string | null
  addTerminal: (info: TerminalInfo) => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string) => void

  // UI
  theme: AppTheme
  toggleTheme: () => void
  sidebarWidth: number
  bottomPanelHeight: number
  bottomPanelVisible: boolean
  setSidebarWidth: (w: number) => void
  setBottomPanelHeight: (h: number) => void
  toggleBottomPanel: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // ===== 项目 =====
  projects: [],

  restoreProjects: async () => {
    const paths = readOpenProjectPaths()
    const restoredPaths: string[] = []

    for (const rootPath of paths) {
      try {
        await get().addProject(rootPath)
        restoredPaths.push(rootPath)
      } catch (err) {
        console.warn('[Store] restore project failed:', rootPath, err)
      }
    }

    localStorage.setItem(OPEN_PROJECTS_STORAGE_KEY, JSON.stringify(restoredPaths))
  },

  addProject: async (rootPath: string) => {
    const existing = get().projects.find(
      (p) => normalizeProjectPath(p.rootPath) === normalizeProjectPath(rootPath)
    )

    if (existing) {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === existing.id ? { ...p, expanded: true } : p
        ),
      }))
      return
    }

    const name = rootPath.split(/[/\\]/).pop() || rootPath
    const id = crypto.randomUUID()
    const project: Project = {
      id,
      name,
      rootPath,
      expanded: true,
      openedAt: Date.now(),
    }
    set((s) => ({ projects: [...s.projects, project] }))
    saveOpenProjectPaths(get().projects)

    // 加载文件树
    await get().loadFileTree(rootPath)

    // 开始监听
    window.electronAPI.watchDir(rootPath)
  },

  removeProject: (id: string) => {
    const project = get().projects.find((p) => p.id === id)
    if (project) {
      window.electronAPI.unwatchDir(project.rootPath)
    }
    set((s) => {
      const { [project?.rootPath || id]: _, ...restTrees } = s.fileTrees
      const projects = s.projects.filter((p) => p.id !== id)
      saveOpenProjectPaths(projects)

      return {
        projects,
        fileTrees: restTrees,
      }
    })
  },

  toggleProjectExpand: (id: string) => {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, expanded: !p.expanded } : p
      ),
    }))
  },

  // ===== 文件树 =====
  fileTrees: {},

  loadFileTree: async (dirPath: string) => {
    const nodes = await window.electronAPI.readDir(dirPath)
    set((s) => ({
      fileTrees: { ...s.fileTrees, [dirPath]: nodes },
    }))
  },

  refreshFileTree: async (rootPath: string) => {
    await get().loadFileTree(rootPath)
  },

  // ===== 编辑器 =====
  openTabs: [],
  activeTabId: null,
  fileContents: {},

  openFile: async (filePath: string) => {
    const state = get()
    // 已打开则切换到该标签
    const existing = state.openTabs.find((t) => t.filePath === filePath)
    if (existing) {
      set({ activeTabId: existing.id })
      window.electronAPI.setWindowTitle(`${existing.fileName} — ${APP_NAME}`)
      return
    }

    const fileName = filePath.split(/[/\\]/).pop() || filePath
    const kind = getTabKind(filePath)
    const language = detectLanguage(filePath)

    if (kind === 'external') {
      await window.electronAPI.openPath(filePath)
      return
    }

    // 文本文件读取内容；图片/PDF 只创建预览标签，不按 UTF-8 读取二进制。
    const content = kind === 'text' ? await window.electronAPI.readFile(filePath) : ''

    const tab: EditorTab = {
      id: filePath,
      filePath,
      fileName,
      language,
      kind,
      isDirty: false,
    }

    set((s) => ({
      openTabs: [...s.openTabs, tab],
      activeTabId: tab.id,
      fileContents: { ...s.fileContents, [filePath]: content },
    }))

    window.electronAPI.setWindowTitle(`${fileName} — ${APP_NAME}`)
  },

  closeTab: (tabId: string) => {
    set((s) => {
      const idx = s.openTabs.findIndex((t) => t.id === tabId)
      const newTabs = s.openTabs.filter((t) => t.id !== tabId)

      let newActive = s.activeTabId
      if (s.activeTabId === tabId) {
        if (newTabs.length === 0) {
          newActive = null
          window.electronAPI.setWindowTitle(APP_NAME)
        } else {
          const nextIdx = Math.min(idx, newTabs.length - 1)
          newActive = newTabs[nextIdx].id
        }
      }

      return { openTabs: newTabs, activeTabId: newActive }
    })
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId })
    const tab = get().openTabs.find((t) => t.id === tabId)
    if (tab) {
      window.electronAPI.setWindowTitle(`${tab.fileName} — ${APP_NAME}`)
    }
  },

  updateFileContent: (filePath: string, content: string) => {
    set((s) => ({
      fileContents: { ...s.fileContents, [filePath]: content },
    }))
  },

  markTabDirty: (filePath: string, dirty: boolean) => {
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.filePath === filePath ? { ...t, isDirty: dirty } : t
      ),
    }))
  },

  // ===== 终端 =====
  terminals: [],
  activeTerminalId: null,

  addTerminal: (info: TerminalInfo) => {
    set((s) => ({
      terminals: [...s.terminals, info],
      activeTerminalId: info.id,
      bottomPanelVisible: true,
    }))
  },

  removeTerminal: (id: string) => {
    set((s) => {
      const newTerms = s.terminals.filter((t) => t.id !== id)
      return {
        terminals: newTerms,
        activeTerminalId:
          s.activeTerminalId === id
            ? newTerms[newTerms.length - 1]?.id || null
            : s.activeTerminalId,
      }
    })
  },

  setActiveTerminal: (id: string) => {
    set({ activeTerminalId: id, bottomPanelVisible: true })
  },

  // ===== UI =====
  theme: (localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'),
  toggleTheme: () => {
    set((s) => {
      const theme: AppTheme = s.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_STORAGE_KEY, theme)
      return { theme }
    })
  },
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  bottomPanelHeight: BOTTOM_PANEL_DEFAULT_HEIGHT,
  bottomPanelVisible: false,

  setSidebarWidth: (w: number) => set({ sidebarWidth: w }),
  setBottomPanelHeight: (h: number) => set({ bottomPanelHeight: h }),
  toggleBottomPanel: () =>
    set((s) => ({
      bottomPanelVisible: !s.bottomPanelVisible,
      // 如果终端列表为空，打开底部面板时自动创建一个"全局终端"
    })),
}))
