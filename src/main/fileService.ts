import * as fs from 'fs/promises'
import * as path from 'path'
import { FileNode, FileSearchResult } from '../shared/types'
import { FILE_TREE_LAZY_DEPTH } from '../shared/constants'

const SEARCH_IGNORED_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'out',
  'build',
  'dist',
  '.vite',
])

const SEARCH_RESULT_LIMIT = 200

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}

export async function readDir(dirPath: string, depth: number = 0): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    // 跳过隐藏文件
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dirPath, entry.name)
    const node: FileNode = {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
      expanded: false,
    }

    if (entry.isDirectory()) {
      // 懒加载：只在深度限制内预加载子节点
      if (depth < FILE_TREE_LAZY_DEPTH) {
        node.children = await readDir(fullPath, depth + 1)
      } else {
        // 标记为可展开，等点击时懒加载
        node.children = []
      }
    }

    nodes.push(node)
  }

  // 排序：文件夹在前，然后按字母排序
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

export async function searchFiles(
  projects: Array<{ name: string; rootPath: string }>,
  query: string
): Promise<FileSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  const results: FileSearchResult[] = []

  for (const project of projects) {
    await searchProjectFiles(project, project.rootPath, normalizedQuery, results)
    if (results.length >= SEARCH_RESULT_LIMIT) break
  }

  return results.slice(0, SEARCH_RESULT_LIMIT)
}

async function searchProjectFiles(
  project: { name: string; rootPath: string },
  dirPath: string,
  query: string,
  results: FileSearchResult[]
): Promise<void> {
  if (results.length >= SEARCH_RESULT_LIMIT) return

  let entries: fs.Dirent[]
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (results.length >= SEARCH_RESULT_LIMIT) return
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (SEARCH_IGNORED_DIRS.has(entry.name)) continue
      await searchProjectFiles(project, fullPath, query, results)
      continue
    }

    if (entry.isFile() && entry.name.toLowerCase().includes(query)) {
      results.push({
        name: entry.name,
        path: fullPath,
        projectRoot: project.rootPath,
        projectName: project.name,
      })
    }
  }
}
