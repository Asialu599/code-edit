# AGENTS.md

本文件面向参与本项目的开发者和 AI 编码助手。GitHub 首页说明请看 `README.md`；开发、架构、命令、协作约定集中放在本文。

## 项目定位

`code-edit` 是一个基于 Electron 的 Windows 桌面代码编辑器，目标是提供：

- 多项目文件夹挂载与文件树浏览
- Monaco Editor 代码编辑与语言识别
- 内嵌终端，默认在当前项目目录启动
- 文件监听、标签页、保存与菜单快捷操作

## 技术栈

- 桌面壳：Electron 42
- 构建：electron-vite + Vite
- 渲染层：React 18 + TypeScript
- 状态管理：Zustand
- 编辑器：Monaco Editor / `@monaco-editor/react`
- 终端：`@xterm/xterm` + `node-pty`
- 文件监听：chokidar

## 目录说明

```text
src/
  main/          Electron 主进程：窗口、菜单、IPC、文件系统、终端、文件监听
  preload/       contextBridge 暴露给渲染进程的安全 API
  renderer/      React 渲染进程：页面、组件、状态、样式
  shared/        主进程与渲染进程共享的类型、常量、语言映射
resources/       应用资源
out/             构建输出，不要手改
build/           打包输出，不要手改
node_modules/    依赖目录，不要手改
DESIGN.md        设计稿与架构说明
```

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run preview
npm run package
```

说明：

- `npm run dev` 启动开发模式。
- `npm run build` 执行 electron-vite 构建。
- `npm run package` 先构建，再通过 electron-builder 打包桌面应用。

## 开发原则

1. 优先保持主进程、preload、渲染进程的职责边界清晰。
2. 渲染进程不能直接使用 Node 能力，必须通过 `src/preload/index.ts` 暴露的 `window.electronAPI` 调用主进程能力。
3. IPC 通道名优先集中维护在 `src/shared/types.ts` 的 `IPC` 对象中；新增通道时同步更新主进程处理器和 preload API。
4. 共享数据结构优先放在 `src/shared/types.ts`，避免主进程与渲染进程各自定义重复类型。
5. UI 状态优先维护在 `src/renderer/store/useAppStore.ts`，组件尽量保持展示和交互职责。
6. 不要手动修改 `out/`、`build/`、`node_modules/` 中的内容。
7. 修改文件系统、终端、窗口、菜单相关逻辑时，要特别注意资源释放和监听清理。

## 关键模块

- `src/main/index.ts`：应用启动入口，注册 IPC、菜单、主窗口和退出清理。
- `src/main/windowManager.ts`：主窗口创建与窗口引用管理。
- `src/main/ipcHandlers.ts`：主进程 IPC 处理器。
- `src/main/fileService.ts`：文件读写与目录读取。
- `src/main/fileWatcher.ts`：项目目录监听。
- `src/main/terminalManager.ts`：终端进程创建、输入、输出、尺寸调整和销毁。
- `src/main/menu.ts`：应用菜单与菜单事件。
- `src/preload/index.ts`：通过 `contextBridge` 暴露安全 API。
- `src/renderer/store/useAppStore.ts`：项目、文件树、标签页、终端和布局状态。
- `src/renderer/components/`：侧边栏、编辑区、终端面板、状态栏等 UI 组件。
- `src/shared/languageMap.ts`：根据文件扩展名识别 Monaco 语言 ID。

## 修改建议

### 新增 IPC 能力

1. 在 `src/shared/types.ts` 增加通道常量。
2. 在 `src/main/ipcHandlers.ts` 注册 `ipcMain.handle` 或事件发送逻辑。
3. 在 `src/preload/index.ts` 暴露类型明确的方法。
4. 如渲染进程需要类型提示，同步更新 `src/renderer/global.d.ts`。
5. 在组件或 store 中通过 `window.electronAPI` 调用。

### 新增 UI 功能

1. 先检查是否已有组件可复用。
2. 跨组件状态放入 Zustand store。
3. 局部展示状态可以留在组件内部。
4. 样式优先沿用 `src/renderer/styles/global.css` 的现有深色编辑器风格。

### 修改终端功能

1. 终端生命周期由 `terminalManager` 管理。
2. 渲染层只保存终端元信息和当前激活终端。
3. 关闭终端时要同时清理前端状态和后端 PTY 进程。
4. Windows 路径要注意反斜杠、盘符和 `cmd.exe` 的工作目录行为。

### 修改文件监听

1. 挂载项目后调用 `watchDir`。
2. 移除项目后调用 `unwatchDir`。
3. 收到目录变化后刷新对应项目文件树。
4. 避免对大型目录做无边界递归或高频刷新。

## 验证清单

完成代码修改后，至少执行：

```bash
npm run build
```

涉及 UI 或 Electron 行为时，还应手动检查：

- 应用能否正常启动
- 打开项目文件夹是否成功
- 文件树是否刷新
- 文件打开、编辑、保存是否正常
- 终端创建、输入、关闭是否正常
- 菜单项和快捷键是否仍然工作

## 注意事项

- 当前项目偏 Windows 桌面场景，终端默认优先使用 `cmd.exe`。
- `node-pty` 对运行环境和 Node/Electron ABI 较敏感，升级 Electron 或 Node 相关依赖后要重点验证终端。
- 文档中的产品设计以 `DESIGN.md` 为准；如实现与设计不一致，修改前请先判断是设计过时还是代码缺失。
