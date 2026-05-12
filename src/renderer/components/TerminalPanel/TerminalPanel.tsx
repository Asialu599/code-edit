import { useEffect, useMemo, useState } from 'react'
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react'
import { TerminalInfo } from '../../../shared/types'
import { useAppStore } from '../../store/useAppStore'
import XtermWrapper from './XtermWrapper'

type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center'

type TerminalLeafNode = {
  id: string
  type: 'leaf'
  terminalIds: string[]
  activeId: string
}

type TerminalSplitNode = {
  id: string
  type: 'split'
  direction: 'row' | 'column'
  ratio: number
  first: TerminalLayoutNode
  second: TerminalLayoutNode
}

type TerminalLayoutNode = TerminalLeafNode | TerminalSplitNode

const TERMINAL_LAYOUT_STORAGE_KEY = 'code-edit.terminalLayout'

function createNodeId(): string {
  return crypto.randomUUID()
}

function createLeaf(terminalId: string): TerminalLeafNode {
  return {
    id: createNodeId(),
    type: 'leaf',
    terminalIds: [terminalId],
    activeId: terminalId,
  }
}

function readSavedLayout(): TerminalLayoutNode | null {
  try {
    const raw = localStorage.getItem(TERMINAL_LAYOUT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLayout(layout: TerminalLayoutNode | null): void {
  if (!layout) {
    localStorage.removeItem(TERMINAL_LAYOUT_STORAGE_KEY)
    return
  }

  localStorage.setItem(TERMINAL_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
}

function collectTerminalIds(node: TerminalLayoutNode | null): string[] {
  if (!node) return []
  if (node.type === 'leaf') return node.terminalIds
  return [...collectTerminalIds(node.first), ...collectTerminalIds(node.second)]
}

function sanitizeLayout(node: TerminalLayoutNode | null, validIds: Set<string>): TerminalLayoutNode | null {
  if (!node) return null

  if (node.type === 'leaf') {
    const terminalIds = node.terminalIds.filter((id) => validIds.has(id))
    if (terminalIds.length === 0) return null

    return {
      ...node,
      terminalIds,
      activeId: terminalIds.includes(node.activeId) ? node.activeId : terminalIds[0],
    }
  }

  const first = sanitizeLayout(node.first, validIds)
  const second = sanitizeLayout(node.second, validIds)
  if (!first) return second
  if (!second) return first

  return { ...node, first, second }
}

function appendTerminal(layout: TerminalLayoutNode | null, terminalId: string): TerminalLayoutNode {
  if (!layout) return createLeaf(terminalId)

  return {
    id: createNodeId(),
    type: 'split',
    direction: 'row',
    ratio: 0.5,
    first: layout,
    second: createLeaf(terminalId),
  }
}

function normalizeLayout(layout: TerminalLayoutNode | null, terminals: TerminalInfo[]): TerminalLayoutNode | null {
  const validIds = new Set(terminals.map((terminal) => terminal.id))
  let nextLayout = sanitizeLayout(layout, validIds)
  const existingIds = new Set(collectTerminalIds(nextLayout))

  for (const terminal of terminals) {
    if (!existingIds.has(terminal.id)) {
      nextLayout = appendTerminal(nextLayout, terminal.id)
      existingIds.add(terminal.id)
    }
  }

  return nextLayout
}

function findLeaf(node: TerminalLayoutNode, terminalId: string): TerminalLeafNode | null {
  if (node.type === 'leaf') {
    return node.terminalIds.includes(terminalId) ? node : null
  }

  return findLeaf(node.first, terminalId) || findLeaf(node.second, terminalId)
}

function removeTerminalFromLayout(
  node: TerminalLayoutNode,
  terminalId: string
): TerminalLayoutNode | null {
  if (node.type === 'leaf') {
    if (!node.terminalIds.includes(terminalId)) return node

    const terminalIds = node.terminalIds.filter((id) => id !== terminalId)
    if (terminalIds.length === 0) return null

    return {
      ...node,
      terminalIds,
      activeId: node.activeId === terminalId ? terminalIds[0] : node.activeId,
    }
  }

  const first = removeTerminalFromLayout(node.first, terminalId)
  const second = removeTerminalFromLayout(node.second, terminalId)
  if (!first) return second
  if (!second) return first

  return { ...node, first, second }
}

function replaceLeaf(
  node: TerminalLayoutNode,
  targetLeafId: string,
  replacer: (leaf: TerminalLeafNode) => TerminalLayoutNode
): TerminalLayoutNode {
  if (node.type === 'leaf') {
    return node.id === targetLeafId ? replacer(node) : node
  }

  return {
    ...node,
    first: replaceLeaf(node.first, targetLeafId, replacer),
    second: replaceLeaf(node.second, targetLeafId, replacer),
  }
}

function moveTerminal(
  layout: TerminalLayoutNode,
  draggedId: string,
  targetLeafId: string,
  zone: DropZone
): TerminalLayoutNode {
  const targetLeaf = findLeafById(layout, targetLeafId)
  if (!targetLeaf) return layout
  if (zone !== 'center' && targetLeaf.terminalIds.length === 1 && targetLeaf.terminalIds[0] === draggedId) {
    return layout
  }

  const withoutDragged = removeTerminalFromLayout(layout, draggedId)
  if (!withoutDragged) return createLeaf(draggedId)

  if (zone === 'center') {
    return replaceLeaf(withoutDragged, targetLeafId, (leaf) => {
      const terminalIds = leaf.terminalIds.includes(draggedId)
        ? leaf.terminalIds
        : [...leaf.terminalIds, draggedId]

      return { ...leaf, terminalIds, activeId: draggedId }
    })
  }

  const direction = zone === 'left' || zone === 'right' ? 'row' : 'column'
  const dragLeaf = createLeaf(draggedId)

  return replaceLeaf(withoutDragged, targetLeafId, (leaf) => ({
    id: createNodeId(),
    type: 'split',
    direction,
    ratio: 0.5,
    first: zone === 'left' || zone === 'top' ? dragLeaf : leaf,
    second: zone === 'left' || zone === 'top' ? leaf : dragLeaf,
  }))
}

function findLeafById(node: TerminalLayoutNode, leafId: string): TerminalLeafNode | null {
  if (node.type === 'leaf') return node.id === leafId ? node : null
  return findLeafById(node.first, leafId) || findLeafById(node.second, leafId)
}

function setLeafActive(
  node: TerminalLayoutNode,
  terminalId: string
): TerminalLayoutNode {
  if (node.type === 'leaf') {
    return node.terminalIds.includes(terminalId) ? { ...node, activeId: terminalId } : node
  }

  return {
    ...node,
    first: setLeafActive(node.first, terminalId),
    second: setLeafActive(node.second, terminalId),
  }
}

function updateSplitRatio(node: TerminalLayoutNode, splitId: string, ratio: number): TerminalLayoutNode {
  if (node.type === 'leaf') return node
  if (node.id === splitId) return { ...node, ratio }

  return {
    ...node,
    first: updateSplitRatio(node.first, splitId, ratio),
    second: updateSplitRatio(node.second, splitId, ratio),
  }
}

function getDropZone(event: DragEvent<HTMLElement>): DropZone {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height

  if (x < 0.25) return 'left'
  if (x > 0.75) return 'right'
  if (y < 0.25) return 'top'
  if (y > 0.75) return 'bottom'
  return 'center'
}

export default function TerminalPanel() {
  const terminals = useAppStore((s) => s.terminals)
  const activeTerminalId = useAppStore((s) => s.activeTerminalId)
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal)
  const removeTerminal = useAppStore((s) => s.removeTerminal)
  const projects = useAppStore((s) => s.projects)
  const terminalProxy = useAppStore((s) => s.terminalProxy)
  const setTerminalProxyAddress = useAppStore((s) => s.setTerminalProxyAddress)
  const enableTerminalProxy = useAppStore((s) => s.enableTerminalProxy)
  const disableTerminalProxy = useAppStore((s) => s.disableTerminalProxy)
  const [layout, setLayout] = useState<TerminalLayoutNode | null>(() => readSavedLayout())
  const [dropTarget, setDropTarget] = useState<{ leafId: string; zone: DropZone } | null>(null)
  const terminalById = useMemo(
    () => new Map(terminals.map((terminal) => [terminal.id, terminal])),
    [terminals]
  )

  useEffect(() => {
    setLayout((current) => normalizeLayout(current, terminals))
  }, [terminals])

  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  useEffect(() => {
    if (activeTerminalId) {
      setLayout((current) => current ? setLeafActive(current, activeTerminalId) : current)
    }
  }, [activeTerminalId])

  const validateProxyAddress = (address: string): boolean => {
    const match = address.trim().match(/^([a-zA-Z0-9.-]+):(\d{1,5})$/)
    if (!match) return false
    const port = Number(match[2])
    return port > 0 && port <= 65535
  }

  const handleNewTerminal = async () => {
    try {
      const cwd = projects[0]?.rootPath || 'C:\\'
      const projectId = projects[0]?.id || 'global'
      const termId = await window.electronAPI.createTerminal(projectId, cwd)
      useAppStore.getState().addTerminal({
        id: termId,
        projectId,
        cwd,
        title: `终端 ${terminals.length + 1}`,
      })
    } catch (err: any) {
      alert('终端创建失败: ' + (err.message || err))
    }
  }

  const handleCloseTerminal = (id: string) => {
    window.electronAPI.killTerminal(id)
    removeTerminal(id)
  }

  const handleEnableProxy = async () => {
    if (!validateProxyAddress(terminalProxy.address)) {
      alert('代理格式不正确，请输入类似 127.0.0.1:6922 的地址')
      return
    }

    try {
      await enableTerminalProxy()
    } catch (err: any) {
      alert('启用代理失败: ' + (err.message || err))
    }
  }

  const handleDisableProxy = async () => {
    try {
      await disableTerminalProxy()
    } catch (err: any) {
      alert('停用代理失败: ' + (err.message || err))
    }
  }

  const handleDrop = (event: DragEvent<HTMLElement>, leafId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const draggedId = event.dataTransfer.getData('text/plain')
    const zone = getDropZone(event)
    setDropTarget(null)

    if (!draggedId || !layout) return

    setLayout(moveTerminal(layout, draggedId, leafId, zone))
    setActiveTerminal(draggedId)
  }

  const handleResizeStart = (
    event: ReactMouseEvent<HTMLDivElement>,
    node: TerminalSplitNode
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const container = event.currentTarget.parentElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rawRatio = node.direction === 'row'
        ? (moveEvent.clientX - rect.left) / rect.width
        : (moveEvent.clientY - rect.top) / rect.height
      const ratio = Math.min(0.82, Math.max(0.18, rawRatio))
      setLayout((current) => current ? updateSplitRatio(current, node.id, ratio) : current)
    }

    const handleMouseUp = () => {
      document.body.classList.remove('is-resizing-terminal-pane')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    document.body.classList.add('is-resizing-terminal-pane')
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const renderNode = (node: TerminalLayoutNode): JSX.Element => {
    if (node.type === 'split') {
      return (
        <div className={`terminal-split terminal-split-${node.direction}`}>
          <div className="terminal-split-child" style={{ flexBasis: `${node.ratio * 100}%` }}>
            {renderNode(node.first)}
          </div>
          <div
            className={`terminal-splitter terminal-splitter-${node.direction}`}
            onMouseDown={(event) => handleResizeStart(event, node)}
            title="拖动调整终端窗格大小"
          />
          <div className="terminal-split-child" style={{ flexBasis: `${(1 - node.ratio) * 100}%` }}>
            {renderNode(node.second)}
          </div>
        </div>
      )
    }

    const leafTerminals = node.terminalIds
      .map((id) => terminalById.get(id))
      .filter((terminal): terminal is TerminalInfo => Boolean(terminal))
    const activeId = leafTerminals.some((terminal) => terminal.id === node.activeId)
      ? node.activeId
      : leafTerminals[0]?.id
    const activeTerminal = activeId ? terminalById.get(activeId) : null
    const isDropTarget = dropTarget?.leafId === node.id

    return (
      <div
        className={`terminal-pane ${activeId === activeTerminalId ? 'active' : ''} ${isDropTarget ? `drop-${dropTarget.zone}` : ''}`}
        onMouseDown={() => activeId && setActiveTerminal(activeId)}
        onDragOver={(event) => {
          event.preventDefault()
          setDropTarget({ leafId: node.id, zone: getDropZone(event) })
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(event) => handleDrop(event, node.id)}
      >
        <div className="terminal-pane-header">
          <div className="terminal-pane-local-tabs">
            {leafTerminals.map((terminal) => (
              <button
                key={terminal.id}
                className={`terminal-pane-local-tab ${terminal.id === activeId ? 'active' : ''}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', terminal.id)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  setActiveTerminal(terminal.id)
                  setLayout((current) => current ? setLeafActive(current, terminal.id) : current)
                }}
                title="拖动到其他终端窗格组合或分屏"
              >
                {terminal.title}
              </button>
            ))}
          </div>
          {activeTerminal && (
            <button
              className="terminal-pane-close"
              onClick={(event) => {
                event.stopPropagation()
                handleCloseTerminal(activeTerminal.id)
              }}
              title="关闭当前终端"
            >
              ✕
            </button>
          )}
        </div>
        <div className="terminal-pane-body">
          {leafTerminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`terminal-instance ${terminal.id === activeId ? 'active' : ''}`}
            >
              <XtermWrapper terminalId={terminal.id} />
            </div>
          ))}
        </div>
        {isDropTarget && <div className="terminal-drop-label">{dropTarget.zone === 'center' ? '合并' : '分屏'}</div>}
      </div>
    )
  }

  const activeLeaf = activeTerminalId && layout ? findLeaf(layout, activeTerminalId) : null

  return (
    <div className="terminal-panel">
      <div className="terminal-toolbar">
        <div className="terminal-tabs">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`terminal-tab ${terminal.id === activeTerminalId ? 'active' : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', terminal.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => {
                setActiveTerminal(terminal.id)
                setLayout((current) => current ? setLeafActive(current, terminal.id) : current)
              }}
              title={activeLeaf?.terminalIds.includes(terminal.id) ? '当前组合内终端' : '点击定位终端，也可拖动组合'}
            >
              <span>{terminal.title}</span>
              <button
                className="terminal-tab-close"
                onClick={(event) => {
                  event.stopPropagation()
                  handleCloseTerminal(terminal.id)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="terminal-toolbar-actions">
          <div className={`terminal-proxy-control ${terminalProxy.enabled ? 'enabled' : ''}`}>
            <input
              className="terminal-proxy-input"
              value={terminalProxy.address}
              onChange={(event) => setTerminalProxyAddress(event.target.value)}
              placeholder="127.0.0.1:6922"
              title="代理地址，格式如 127.0.0.1:6922"
            />
            {terminalProxy.enabled ? (
              <button className="terminal-action-btn proxy-toggle active" onClick={handleDisableProxy}>
                停用代理
              </button>
            ) : (
              <button className="terminal-action-btn proxy-toggle" onClick={handleEnableProxy}>
                启用代理
              </button>
            )}
          </div>
          <button className="terminal-action-btn" onClick={handleNewTerminal} title="新建终端">
            {terminals.length === 0 ? '+ 新建终端' : '+'}
          </button>
        </div>
      </div>
      <div className="terminal-container terminal-layout">
        {layout && terminals.length > 0 ? (
          renderNode(layout)
        ) : (
          <div className="terminal-empty">
            <span>点击 "+" 新建终端</span>
          </div>
        )}
      </div>
    </div>
  )
}
