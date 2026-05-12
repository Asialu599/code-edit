# 多项目代码编辑器 — 设计稿

## 1. 项目概述

一个 Windows 桌面代码编辑器，核心能力：

1. **智能语言识别**：打开文件时根据后缀名自动识别代码语言，启用对应的语法高亮
2. **多项目管理**：左侧边栏可同时挂载多个项目文件夹，自由切换
3. **集成终端**：编辑器内嵌 CMD，自动定位到当前项目目录

---

## 2. 技术栈

| 层 | 技术 | 版本 | 理由 |
|---|---|---|---|
| 桌面框架 | **Electron** | 42.x | 跨平台桌面壳，Chromium M148 + Node.js v24 |
| 编辑器核心 | **Monaco Editor** | 0.55.x | VS Code 同款内核，100+ 语言原生语法高亮 |
| 终端模拟 | **@xterm/xterm** | 6.0.0 | GPU 加速 WebGL 渲染，VS Code 同款终端 |
| PTY 后端 | **node-pty** | latest | Windows 上使用 conpty.dll，完整 CMD 支持 |
| UI 框架 | **React** | 18.x | 组件化 UI，生态成熟 |
| 状态管理 | **Zustand** | 4.x | 轻量、无模板代码、支持 Electron 多窗口 |
| 构建工具 | **Vite** + electron-vite | latest | 快速 HMR，主进程/渲染进程统一构建 |

---

## 3. 架构设计

### 3.1 进程架构

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process (主进程)                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 窗口管理器    │  │ 文件系统服务  │  │  终端管理器    │  │
│  │ WindowMgr    │  │ FileService  │  │ TerminalMgr   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         └─────────────────┼───────────────────┘          │
│                           │                              │
│                    ┌──────┴──────┐                       │
│                    │  IPC Bridge │                       │
│                    └──────┬──────┘                       │
└───────────────────────────┼──────────────────────────────┘
                            │ contextBridge
┌───────────────────────────┼──────────────────────────────┐
│                 Renderer Process (渲染进程)                 │
│                           │                              │
│  ┌────────────────────────┴──────────────────────────┐   │
│  │                   preload API                       │   │
│  │  window.electronAPI.readFile / watchDir / spawnTerm │   │
│  └────────────────────────┬──────────────────────────┘   │
│                           │                              │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Sidebar │  │  Editor   │  │ Terminal │  │ Toolbar │ │
│  │ 侧边栏   │  │  编辑区    │  │  终端     │  │  工具栏  │ │
│  └─────────┘  └───────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 关键设计原则

- **安全**：通过 `contextBridge` + `preload.ts` 暴露有限 API，不开放 `nodeIntegration`
- **性能**：Monaco Editor 启用 Web Worker 做语法分析，xterm 使用 WebGL 渲染器
- **隔离**：每个项目的文件监听独立管理，关闭项目时释放所有 watcher

---

## 4. UI 布局设计

### 4.1 主窗口布局

```
┌──────────────────────────────────────────────────────────────────┐
│  File  Edit  Selection  View  Help          ─ □ ×               │ ← 原生菜单栏
├───────────┬──────────────────────────────────┬───────────────────┤
│  📁 项目   │  tab1.java  tab2.json  tab3.js  │                   │ ← 标签栏
│  Explorer ├──────────────────────────────────┤                   │
│           │                                  │                   │
│  ┌───────┐│  1  public class Main {          │                   │
│  │ ▼ 🗀   ││  2      public static void      │                   │
│  │  java-││  3          main(String[] args)  │                   │
│  │  proj ││  4          System.out.println   │                   │
│  │   ├── ││  5              ("Hello World"); │                   │
│  │   │Ma ││  6      }                        │                   │
│  │   │   ││  7  }                            │                   │
│  │   ├── ││                                  │                   │
│  │   │Ut ││                                  │                   │
│  │       ││                                  │                   │
│  │ ▼ 🗀   ││                                  │                   │
│  │  my-a││                                  │                   │
│  │   ├── ││                                  │                   │
│  │   │pa ││                                  │                   │
│  │   │   ││                                  │                   │
│  │   ├── ││                                  │                   │
│  │   │co ││                                  │                   │
│  └───────┘│                                  │                   │
│           ├──────────────────────────────────┤                   │
│           │  C:\Users\PC\projects\java-proj> │ ← 终端输入行      │
│           │  > java Main                     │                   │
│           │  Hello World                      │                   │
│           │  > _                              │ ← 内嵌 CMD       │
│           │                                  │                   │
│           │  TERMINAL  │  PROBLEMS  │ OUTPUT │ ← 底部面板标签    │
├───────────┴────────────┴─────────────────────┴───────────────────┤
│  Ln 5, Col 22   Spaces: 4   UTF-8   Java          │ 状态栏      │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 布局比例（参考）

| 区域 | 默认宽度/高度 | 可调整 |
|---|---|---|
| 侧边栏（项目浏览器） | 260px | 是，拖拽边缘 |
| 编辑区 | 剩余宽度 | — |
| 底部面板（终端） | 200px | 是，拖拽上边缘 |
| 编辑器 : 终端 | 70% : 30% | 是 |

---

## 5. 组件树

```
<App>
  <MenuBar />                          // 原生菜单（main process）
  <MainLayout>
    <Sidebar>                          // 左侧边栏
      <SidebarTabs>
        <ExplorerTab />                // 文件浏览器（默认激活）
        <SearchTab />                  // 全局搜索（后续版本）
      </SidebarTabs>
      <ProjectList>                    // 项目列表
        <ProjectItem key={id}>         // 单个项目根节点
          <ProjectHeader />            // 项目名 + 折叠按钮
          <FileTree />                 // 文件树（递归）
            <FileTreeNode />          // 文件/文件夹节点
        </ProjectItem>
      </ProjectList>
      <ProjectActions>                 // "+" 按钮打开新项目
        <AddProjectButton />
      </ProjectActions>
    </Sidebar>

    <EditorArea>                       // 右侧主区域
      <TabBar>                         // 已打开文件的标签
        <TabItem key={path} />         // 单个标签（文件名 + 关闭按钮）
      </TabBar>
      <EditorPane>                     // 编辑器容器
        <MonacoWrapper />             // Monaco Editor 实例
        <WelcomeScreen />             // 无文件打开时的欢迎页
      </EditorPane>

      <BottomPanel>                    // 底部可调节面板
        <PanelTabs>                    // 面板标签切换
          <PanelTab label="TERMINAL" />
          <PanelTab label="PROBLEMS" />
        </PanelTabs>
        <TerminalPanel>                // 终端面板
          <TerminalToolbar />          // 终端工具栏（+ 新建 / 切换 / 关闭）
          <TerminalInstanceList>       // 多个终端实例
            <XtermWrapper key={id} />  // xterm.js 终端实例
          </TerminalInstanceList>
        </TerminalPanel>
      </BottomPanel>
    </EditorArea>

    <StatusBar />                      // 底部状态栏
  </MainLayout>
</App>
```

---

## 6. 核心数据模型

### 6.1 TypeScript 类型定义

```typescript
// ===== 项目 =====
interface Project {
  id: string;                    // UUID
  name: string;                  // 项目名（取文件夹名）
  rootPath: string;              // 项目根目录绝对路径
  fileTree: FileNode[];          // 文件树
  isExpanded: boolean;           // 侧边栏是否展开
  openedAt: number;              // 添加时间戳，用于排序
}

// ===== 文件树节点 =====
interface FileNode {
  name: string;
  path: string;                  // 绝对路径
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

// ===== 编辑器标签 =====
interface EditorTab {
  id: string;                    // 文件路径作为唯一 ID
  filePath: string;
  fileName: string;
  language: LanguageId;          // Monaco 语言 ID
  isDirty: boolean;              // 是否有未保存修改
  editorState?: object;          // 保存的编辑器状态（光标、滚动位置）
}

// ===== 终端实例 =====
interface TerminalInstance {
  id: string;                    // UUID
  projectId: string;             // 所属项目 ID
  cwd: string;                   // 当前工作目录
  title: string;                 // 终端标签名
  ptyPid: number;                // PTY 进程 PID
}

// ===== 语言映射 =====
type LanguageId = string;        // Monaco LanguageIdentifier
// 例如: "java" | "javascript" | "typescript" | "json" | "python" | ...
```

### 6.2 Zustand Store 结构

```typescript
interface AppStore {
  // 项目
  projects: Project[];
  addProject: (rootPath: string) => void;
  removeProject: (id: string) => void;
  toggleProjectExpand: (id: string) => void;

  // 编辑器
  openTabs: EditorTab[];
  activeTabId: string | null;
  openFile: (filePath: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // 终端
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  createTerminal: (projectId: string) => void;
  closeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;

  // UI 状态
  sidebarWidth: number;
  bottomPanelHeight: number;
  isBottomPanelVisible: boolean;
}
```

---

## 7. 核心功能实现

### 7.1 文件后缀 → 语言自动识别

#### 映射策略（三级匹配）

```
优先级 1 → Monaco 原生支持的语言（直接匹配）
优先级 2 → 自定义扩展映射（补充映射）
优先级 3 → fallback 为 plaintext
```

#### 实现代码

```typescript
// src/shared/languageMap.ts

// Monaco 内置语言映射（部分核心映射）
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // Java
  '.java': 'java',
  '.class': 'java',
  '.jar': 'java',

  // JavaScript / TypeScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.vue': 'html',
  '.svelte': 'html',

  // JSON / YAML / XML
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.svg': 'xml',
  '.toml': 'plaintext',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.ipynb': 'python',

  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',

  // C#
  '.cs': 'csharp',
  '.csx': 'csharp',

  // Go
  '.go': 'go',

  // Rust
  '.rs': 'rust',

  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.bat': 'bat',
  '.cmd': 'bat',

  // SQL
  '.sql': 'sql',

  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',

  // Docker
  'Dockerfile': 'dockerfile',
  '.dockerfile': 'dockerfile',

  // Config
  '.ini': 'ini',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.env': 'plaintext',
  '.gitignore': 'plaintext',

  // 其他
  '.log': 'plaintext',
  '.txt': 'plaintext',
  '.csv': 'plaintext',
};

/**
 * 根据文件路径自动检测语言
 * 优先级：后缀映射 > shebang 检测 > plaintext
 */
export function detectLanguage(filePath: string, content?: string): string {
  // 1. 先检查特殊文件名（如 Dockerfile, Makefile, .gitignore）
  const fileName = path.basename(filePath);
  if (EXTENSION_TO_LANGUAGE[fileName]) {
    return EXTENSION_TO_LANGUAGE[fileName];
  }

  // 2. 通过文件后缀匹配
  const ext = path.extname(filePath).toLowerCase();
  if (EXTENSION_TO_LANGUAGE[ext]) {
    return EXTENSION_TO_LANGUAGE[ext];
  }

  // 3. shebang 检测
  if (content && content.startsWith('#!')) {
    const shebang = content.split('\n')[0];
    if (shebang.includes('python')) return 'python';
    if (shebang.includes('node')) return 'javascript';
    if (shebang.includes('bash')) return 'shell';
    if (shebang.includes('sh')) return 'shell';
  }

  // 4. 兜底
  return 'plaintext';
}
```

#### Monaco 初始化时设置语言

```typescript
// src/renderer/components/EditorPane/MonacoWrapper.tsx

const editor = monaco.editor.create(containerRef.current, {
  value: fileContent,
  language: detectLanguage(filePath, fileContent),  // ← 自动检测
  theme: 'vs-dark',
  automaticLayout: true,    // 窗口大小变化时自动重排
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  fontSize: 14,
  tabSize: 4,
  wordWrap: 'off',
});
```

### 7.2 多项目管理

#### 核心流程

```
用户点击 "+ 添加项目"
       │
       ▼
主进程打开 native 文件夹选择对话框 (dialog.showOpenDialog)
       │
       ▼
主进程读取项目目录，构建初始 FileNode 树（深度限制 2 层，懒加载）
       │
       ▼
通过 IPC 发送给渲染进程 → 添加到 Zustand projects[]
       │
       ▼
侧边栏渲染 <ProjectItem>，文件树 <FileTree>
       │
       ▼
主进程使用 chokidar 监听该目录变化 → 增量更新文件树
```

#### 文件树懒加载策略

```typescript
// 初始仅加载第一层子节点
// 用户展开文件夹时，再加载该文件夹的子节点
async function expandDirectory(dirPath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(e => !e.name.startsWith('.') || showHiddenFiles)
    .map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
      children: e.isDirectory() ? [] : undefined,  // 文件夹预留给懒加载
      isExpanded: false,
    }));
}
```

#### 跨项目文件打开

```typescript
// 打开文件时不关心它在哪个项目，直接通过绝对路径映射
function openFile(filePath: string, store: AppStore) {
  // 检查是否已在标签页中打开
  const existingTab = store.openTabs.find(t => t.filePath === filePath);
  if (existingTab) {
    store.setActiveTab(existingTab.id);
    return;
  }

  // 读取文件内容
  const content = window.electronAPI.readFile(filePath);
  const language = detectLanguage(filePath, content);

  // 创建新标签
  const newTab: EditorTab = {
    id: filePath,
    filePath,
    fileName: path.basename(filePath),
    language,
    isDirty: false,
  };

  store.openTabs.push(newTab);
  store.setActiveTab(newTab.id);
}
```

### 7.3 集成 CMD 终端

#### 架构

```
┌─────────────────────────────────────────────────┐
│              Renderer Process                    │
│  ┌───────────────────────────────────────┐      │
│  │         <XtermWrapper />               │      │
│  │  ┌─────────────────────────────────┐  │      │
│  │  │  xterm.js Terminal (WebGL)      │  │      │
│  │  │  用户输入字符 → terminal.onData │  │      │
│  │  └──────────────┬──────────────────┘  │      │
│  └─────────────────┼─────────────────────┘      │
│                    │ ipcRenderer.invoke         │
│                    │ 'terminal:write'           │
└────────────────────┼────────────────────────────┘
                     │
            contextBridge
                     │
┌────────────────────┼────────────────────────────┐
│              Main Process                        │
│  ┌─────────────────┴───────────────────────┐    │
│  │           TerminalManager                │    │
│  │  ┌──────────────────────────────────┐   │    │
│  │  │  node-pty (conpty.dll on Win)    │   │    │
│  │  │  ┌────────────────────────────┐  │   │    │
│  │  │  │  cmd.exe                   │  │   │    │
│  │  │  │  cwd = 项目根目录           │  │   │    │
│  │  │  └────────┬───────────────────┘  │   │    │
│  │  │           │ pty.onData()         │   │    │
│  │  └───────────┼──────────────────────┘   │    │
│  └──────────────┼──────────────────────────┘    │
│                 │ ipcMain.send                  │
│                 │ 'terminal:data'               │
└─────────────────┼──────────────────────────────┘
                  │
       (返回渲染进程 → terminal.write(data))
```

#### 主进程终端管理

```typescript
// src/main/terminalManager.ts
import * as pty from 'node-pty';
import { BrowserWindow, ipcMain } from 'electron';

interface TerminalProcess {
  id: string;
  ptyProcess: pty.IPty;
  projectId: string;
  cwd: string;
  windowId: number;  // 所属窗口
}

class TerminalManager {
  private terminals: Map<string, TerminalProcess> = new Map();

  create(window: BrowserWindow, projectId: string, cwd: string): string {
    const id = crypto.randomUUID();

    // 在 Windows 上默认使用 cmd.exe
    const shell = process.platform === 'win32'
      ? 'cmd.exe'
      : process.env.SHELL || '/bin/bash';

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: cwd,           // ← 自动定位到项目目录
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    });

    // PTY 输出 → 渲染进程
    ptyProcess.onData((data: string) => {
      window.webContents.send('terminal:data', { id, data });
    });

    // PTY 退出
    ptyProcess.onExit(({ exitCode }) => {
      window.webContents.send('terminal:exit', { id, exitCode });
      this.terminals.delete(id);
    });

    this.terminals.set(id, { id, ptyProcess, projectId, cwd, windowId: window.id });
    return id;
  }

  write(id: string, data: string) {
    this.terminals.get(id)?.ptyProcess.write(data);
  }

  resize(id: string, cols: number, rows: number) {
    this.terminals.get(id)?.ptyProcess.resize(cols, rows);
  }

  kill(id: string) {
    this.terminals.get(id)?.ptyProcess.kill();
    this.terminals.delete(id);
  }

  dispose(windowId: number) {
    for (const [id, t] of this.terminals) {
      if (t.windowId === windowId) {
        t.ptyProcess.kill();
        this.terminals.delete(id);
      }
    }
  }
}
```

#### 渲染进程终端组件

```typescript
// src/renderer/components/TerminalPanel/XtermWrapper.tsx
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

function XtermWrapper({ terminalId, projectId, cwd }: Props) {
  const terminalRef = useRef<Terminal>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = new Terminal({
      fontSize: 14,
      fontFamily: 'Cascadia Code, Consolas, monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
      overviewRuler: { width: 6 },    // v6 新 API
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // 优先使用 WebGL 渲染器
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // 回退到 DOM 渲染
    }

    term.open(containerRef.current!);
    fitAddon.fit();

    // 用户输入 → 主进程
    term.onData((data) => {
      window.electronAPI.writeTerminal(terminalId, data);
    });

    // 接收主进程 PTY 输出
    const cleanup = window.electronAPI.onTerminalData(({ id, data }) => {
      if (id === terminalId) {
        term.write(data);
      }
    });

    terminalRef.current = term;
    return () => { cleanup(); term.dispose(); };
  }, [terminalId]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

---

## 8. IPC 通信接口设计

### preload.ts 暴露的 API

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // === 文件系统 ===
  readFile: (filePath: string) =>
    ipcRenderer.invoke('fs:readFile', filePath),

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),

  readDir: (dirPath: string) =>
    ipcRenderer.invoke('fs:readDir', dirPath),

  openFolderDialog: () =>
    ipcRenderer.invoke('dialog:openFolder'),

  watchDir: (dirPath: string, callback: (event: string, filePath: string) => void) => {
    const handler = (_: any, data: any) => callback(data.event, data.filePath);
    ipcRenderer.on('fs:dirChanged', handler);
    return () => ipcRenderer.removeListener('fs:dirChanged', handler);
  },

  // === 终端 ===
  createTerminal: (projectId: string, cwd: string) =>
    ipcRenderer.invoke('terminal:create', projectId, cwd),

  writeTerminal: (id: string, data: string) =>
    ipcRenderer.invoke('terminal:write', id, data),

  resizeTerminal: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', id, cols, rows),

  killTerminal: (id: string) =>
    ipcRenderer.invoke('terminal:kill', id),

  onTerminalData: (callback: (data: { id: string; data: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },

  onTerminalExit: (callback: (data: { id: string; exitCode: number }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },

  // === 编辑器控制 ===
  setWindowTitle: (title: string) =>
    ipcRenderer.invoke('window:setTitle', title),
});
```

---

## 9. 项目目录结构

```
code-editor/
├── package.json
├── electron.vite.config.ts         // electron-vite 配置
├── tsconfig.json
│
├── src/
│   ├── main/                       // 主进程
│   │   ├── index.ts               // 入口：窗口创建、IPC 注册
│   │   ├── windowManager.ts       // 窗口生命周期管理
│   │   ├── fileService.ts         // 文件读写、目录遍历
│   │   ├── fileWatcher.ts         // chokidar 文件监听
│   │   ├── terminalManager.ts     // node-pty 终端管理
│   │   └── ipcHandlers.ts         // 注册所有 IPC handler
│   │
│   ├── preload/                    // Preload 脚本
│   │   └── index.ts               // contextBridge 暴露 API
│   │
│   ├── renderer/                   // 渲染进程
│   │   ├── index.html
│   │   ├── main.tsx               // React 入口
│   │   ├── App.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ProjectItem.tsx
│   │   │   │   └── FileTree.tsx
│   │   │   │
│   │   │   ├── EditorArea/
│   │   │   │   ├── EditorArea.tsx
│   │   │   │   ├── TabBar.tsx
│   │   │   │   ├── MonacoWrapper.tsx
│   │   │   │   └── WelcomeScreen.tsx
│   │   │   │
│   │   │   ├── TerminalPanel/
│   │   │   │   ├── TerminalPanel.tsx
│   │   │   │   ├── TerminalToolbar.tsx
│   │   │   │   └── XtermWrapper.tsx
│   │   │   │
│   │   │   ├── StatusBar/
│   │   │   │   └── StatusBar.tsx
│   │   │   │
│   │   │   └── common/
│   │   │       └── ResizeHandle.tsx   // 可拖拽分隔条
│   │   │
│   │   ├── store/
│   │   │   ├── useAppStore.ts        // Zustand 主 store
│   │   │   ├── useEditorStore.ts     // 编辑器状态 slice
│   │   │   ├── useProjectStore.ts    // 项目管理 slice
│   │   │   └── useTerminalStore.ts   // 终端管理 slice
│   │   │
│   │   ├── hooks/
│   │   │   ├── useMonacoEditor.ts    // Monaco 实例管理 hook
│   │   │   ├── useTerminal.ts        // 终端实例管理 hook
│   │   │   └── useFileWatcher.ts     // 文件变更监听 hook
│   │   │
│   │   └── styles/
│   │       ├── global.css
│   │       ├── variables.css         // CSS 变量（主题色）
│   │       └── components/
│   │
│   └── shared/                       // 主进程 & 渲染进程共享
│       ├── types.ts                  // TypeScript 类型定义
│       ├── languageMap.ts           // 文件后缀 → 语言映射
│       └── constants.ts             // 常量定义
│
├── resources/                        // 应用图标等静态资源
│   └── icon.ico
│
└── build/                            // 打包配置
    └── electron-builder.yml
```

---

## 10. 关键 npm 依赖

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "monaco-editor": "^0.55.0",
    "@xterm/xterm": "^6.0.0",
    "@xterm/addon-fit": "^0.11.0",
    "@xterm/addon-webgl": "^0.19.0",
    "@xterm/addon-web-links": "^0.12.0"
  },
  "devDependencies": {
    "electron": "^42.0.0",
    "electron-vite": "^2.4.0",
    "electron-builder": "^25.0.0",
    "node-pty": "^1.0.0",
    "chokidar": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

---

## 11. 主题与配色参考

采用 VS Code 风格暗色主题作为默认：

| 元素 | 色值 | 说明 |
|---|---|---|
| 主背景 | `#1e1e1e` | 编辑区、终端背景 |
| 侧边栏背景 | `#252526` | 文件浏览器 |
| 标签栏背景 | `#2d2d2d` | 顶部标签 |
| 状态栏背景 | `#007acc` | 底部状态栏 |
| 文字主色 | `#cccccc` | 一般文字 |
| 文字次色 | `#969696` | 文件树灰字 |
| 选中高亮 | `#094771` | 列表选中 |
| 终端蓝色 | `#569cd6` | 关键字色 |
| 终端绿色 | `#6a9955` | 注释色 |

---

## 12. 开发路线图

### Phase 1 — 基础骨架（MVP）
- [ ] Electron 窗口创建 + 基础布局（侧边栏 + 编辑区）
- [ ] Monaco Editor 集成 + 语法高亮 + 语言自动识别
- [ ] 文件打开/保存/新建
- [ ] Zustand 状态管理搭建

### Phase 2 — 多项目 + 文件浏览
- [ ] 侧边栏项目列表 + 文件树
- [ ] 添加/移除项目
- [ ] 文件树懒加载 + chokidar 监听
- [ ] 多标签页管理

### Phase 3 — 集成终端
- [ ] node-pty + xterm.js 集成
- [ ] CMD 定位到项目目录
- [ ] 多终端实例 + 切换/关闭
- [ ] 终端与项目关联

### Phase 4 — 完善体验
- [ ] 文件保存/未保存提示
- [ ] 拖拽调节面板大小
- [ ] 右键菜单（文件操作）
- [ ] 基础搜索（文件内搜索）
- [ ] 键盘快捷键
- [ ] 近期项目列表
- [ ] 打包为 Windows 安装包（electron-builder, NSIS）

---

## 13. 备用方案对比

| 方案 | 编辑器 | 终端 | 适用场景 |
|---|---|---|---|
| **A（推荐）** | Monaco Editor | xterm.js + node-pty | 功能完整，接近 VS Code 体验 |
| B | CodeMirror 6 | xterm.js + node-pty | 更轻量，但语法高亮语言少于 Monaco |
| C | Ace Editor | xterm.js + node-pty | 历史方案，生态不如 Monaco 活跃 |
| D（纯原生） | Scintilla (C++) | Win32 Console API | 体积最小但开发成本极高 |

**推荐方案 A**：Monaco Editor 自带 100+ 语言支持，xterm.js v6 提供 GPU 加速渲染，Electron 42 提供最新 Chromium 内核，三者组合兼顾开发效率和用户体验。
