'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type NodeMouseHandler,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { supabase } from '@/lib/supabase'

const DEFAULT_NODES: Node[] = [
  { id: '1', position: { x: 250, y: 200 }, data: { label: 'メインアイデア' } },
]

function MindMapCanvas({ projectId }: { projectId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(DEFAULT_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [mindMapId, setMindMapId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const initialized = useRef(false)
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('mind_maps')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()

      if (data) {
        setMindMapId(data.id)
        setNodes((data.nodes as Node[])?.length > 0 ? (data.nodes as Node[]) : DEFAULT_NODES)
        setEdges((data.edges as Edge[]) || [])
      } else {
        const { data: created } = await supabase
          .from('mind_maps')
          .insert({ project_id: projectId, nodes: DEFAULT_NODES, edges: [] })
          .select()
          .single()
        if (created) {
          setMindMapId(created.id)
          setNodes(DEFAULT_NODES)
        }
      }
      initialized.current = true
    }
    load()
  }, [projectId, setNodes, setEdges])

  // Debounced auto-save
  useEffect(() => {
    if (!mindMapId || !initialized.current) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      supabase.from('mind_maps').update({ nodes, edges }).eq('id', mindMapId)
    }, 1500)
    return () => clearTimeout(saveTimer.current)
  }, [nodes, edges, mindMapId])

  const onConnect = useCallback((params: Connection) => {
    setEdges(es => addEdge({ ...params, animated: false }, es))
  }, [setEdges])

  // Double-click on the outer wrapper to add node (pane only, not nodes)
  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('.react-flow__node')) return
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const newNode: Node = {
      id: `node-${Date.now()}`,
      position,
      data: { label: '新しいアイデア' },
    }
    setNodes(ns => [...ns, newNode])
  }, [screenToFlowPosition, setNodes])

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    setEditingId(node.id)
    setEditLabel(String(node.data.label))
  }, [])

  function saveLabel() {
    if (!editingId) return
    setNodes(ns => ns.map(n =>
      n.id === editingId ? { ...n, data: { ...n.data, label: editLabel } } : n
    ))
    setEditingId(null)
  }

  function addNode() {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      position: { x: 80 + Math.random() * 300, y: 80 + Math.random() * 250 },
      data: { label: '新しいアイデア' },
    }
    setNodes(ns => [...ns, newNode])
  }

  return (
    <div className="relative mt-4" style={{ height: 520 }}>
      <div
        className="absolute inset-0 border border-gray-200 rounded-lg overflow-hidden"
        onDoubleClick={handleDoubleClick}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          deleteKeyCode="Backspace"
          fitView
        >
          <Background />
          <Controls />
          <Panel position="top-right">
            <button
              onClick={addNode}
              className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded shadow-sm hover:bg-gray-50"
            >
              + ノード追加
            </button>
          </Panel>
          <Panel position="top-left">
            <p className="text-xs text-gray-400 bg-white/90 backdrop-blur px-2 py-1 rounded">
              ダブルクリックでノード追加 / ノードをダブルクリックで編集 / Backspaceで削除
            </p>
          </Panel>
        </ReactFlow>
      </div>

      {editingId && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-lg p-4 shadow-xl w-72 space-y-3">
            <p className="text-sm font-medium text-gray-700">ノードを編集</p>
            <input
              autoFocus
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveLabel()
                if (e.key === 'Escape') setEditingId(null)
              }}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <div className="flex gap-2">
              <button onClick={saveLabel} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700">保存</button>
              <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded hover:bg-gray-100">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MindMapEditor({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <MindMapCanvas projectId={projectId} />
    </ReactFlowProvider>
  )
}
