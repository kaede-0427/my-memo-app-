'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  Panel,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  type Connection,
  type NodeMouseHandler,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { supabase } from '@/lib/supabase'

// ---- ノードカラー設定 ----
const NODE_COLORS = [
  { label: 'デフォルト', bg: '#ffffff', border: '#d1d5db' },
  { label: '青', bg: '#dbeafe', border: '#93c5fd' },
  { label: '緑', bg: '#dcfce7', border: '#86efac' },
  { label: '黄', bg: '#fef9c3', border: '#fde047' },
  { label: 'ピンク', bg: '#fce7f3', border: '#f9a8d4' },
  { label: '紫', bg: '#ede9fe', border: '#c4b5fd' },
]

const NODE_SIZES = {
  small: { padding: '4px 12px', fontSize: '12px', minWidth: '70px' },
  medium: { padding: '8px 18px', fontSize: '14px', minWidth: '110px' },
  large: { padding: '12px 28px', fontSize: '17px', minWidth: '160px' },
}

type NodeSize = 'small' | 'medium' | 'large'

// ---- カスタムノード（4方向ハンドル）----
function MindMapNode({ data }: NodeProps) {
  const bgColor = (data.bgcolor as string) || '#ffffff'
  const colorConfig = NODE_COLORS.find(c => c.bg === bgColor) || NODE_COLORS[0]
  const size = NODE_SIZES[(data.size as NodeSize) || 'medium']

  const handleStyle = { background: '#9ca3af', width: 8, height: 8 }

  return (
    <div style={{
      background: bgColor,
      border: `1.5px solid ${colorConfig.border}`,
      borderRadius: 8,
      ...size,
      textAlign: 'center' as const,
      cursor: 'default',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <Handle type="source" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" style={handleStyle} />
      <span style={{ fontSize: size.fontSize, userSelect: 'none' }}>
        {String(data.label || '')}
      </span>
    </div>
  )
}

const nodeTypes = { mindmap: MindMapNode }

const DEFAULT_NODES: Node[] = [
  {
    id: '1',
    type: 'mindmap',
    position: { x: 250, y: 200 },
    data: { label: 'メインアイデア', bgcolor: '#ffffff', size: 'medium' },
  },
]

// ---- キャンバス本体 ----
function MindMapCanvas({ projectId }: { projectId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(DEFAULT_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [mindMapId, setMindMapId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 編集ダイアログ
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('#ffffff')
  const [editSize, setEditSize] = useState<NodeSize>('medium')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const initialized = useRef(false)
  const { screenToFlowPosition } = useReactFlow()

  // ---- データ読み込み ----
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('mind_maps').select('*').eq('project_id', projectId).maybeSingle()

      if (data) {
        setMindMapId(data.id)
        // 既存ノードを mindmap タイプに変換
        const loadedNodes: Node[] = ((data.nodes as Node[]) || []).length > 0
          ? (data.nodes as Node[]).map(n => ({
              ...n,
              type: 'mindmap',
              data: { label: n.data?.label || '', bgcolor: n.data?.bgcolor || '#ffffff', size: n.data?.size || 'medium' },
            }))
          : DEFAULT_NODES
        setNodes(loadedNodes)
        setEdges((data.edges as Edge[]) || [])
      } else {
        const { data: created } = await supabase
          .from('mind_maps')
          .insert({ project_id: projectId, nodes: DEFAULT_NODES, edges: [] })
          .select().single()
        if (created) { setMindMapId(created.id); setNodes(DEFAULT_NODES) }
      }
      initialized.current = true
    }
    load()
  }, [projectId, setNodes, setEdges])

  // ---- 自動保存（デバウンス）----
  useEffect(() => {
    if (!mindMapId || !initialized.current) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      supabase.from('mind_maps').update({ nodes, edges }).eq('id', mindMapId)
    }, 2000)
    return () => clearTimeout(saveTimer.current)
  }, [nodes, edges, mindMapId])

  // ---- 手動保存 ----
  async function saveNow() {
    if (!mindMapId) return
    setSaving(true)
    await supabase.from('mind_maps').update({ nodes, edges }).eq('id', mindMapId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const onConnect = useCallback((params: Connection) => {
    setEdges(es => addEdge({ ...params, animated: false }, es))
  }, [setEdges])

  // ダブルクリックでノード追加
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.react-flow__node')) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setNodes(ns => [...ns, {
      id: `node-${Date.now()}`,
      type: 'mindmap',
      position,
      data: { label: '新しいアイデア', bgcolor: '#ffffff', size: 'medium' },
    }])
  }, [screenToFlowPosition, setNodes])

  // ノードをダブルクリックで編集ダイアログ
  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    setEditingId(node.id)
    setEditLabel(String(node.data.label || ''))
    setEditColor(String(node.data.bgcolor || '#ffffff'))
    setEditSize((node.data.size as NodeSize) || 'medium')
  }, [])

  function addNode() {
    setNodes(ns => [...ns, {
      id: `node-${Date.now()}`,
      type: 'mindmap',
      position: { x: 100 + Math.random() * 300, y: 80 + Math.random() * 250 },
      data: { label: '新しいアイデア', bgcolor: '#ffffff', size: 'medium' },
    }])
  }

  function saveNodeEdit() {
    if (!editingId) return
    setNodes(ns => ns.map(n => n.id === editingId
      ? { ...n, type: 'mindmap', data: { ...n.data, label: editLabel, bgcolor: editColor, size: editSize } }
      : n
    ))
    setEditingId(null)
  }

  return (
    <div className="relative mt-4" style={{ height: 540 }}>
      <div className="absolute inset-0 border border-gray-200 rounded-lg overflow-hidden"
        onDoubleClick={handleDoubleClick}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode="Backspace"
          fitView
        >
          <Background />
          <Controls />
          <Panel position="top-right">
            <div className="flex gap-2">
              <button onClick={addNode}
                className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded shadow-sm hover:bg-gray-50">
                + ノード追加
              </button>
              <button onClick={saveNow} disabled={saving}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded shadow-sm hover:bg-gray-700 disabled:opacity-50">
                {saving ? '保存中...' : saved ? '保存済み' : '保存'}
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* 編集ダイアログ */}
      {editingId && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-xl p-5 shadow-xl w-80 space-y-4">
            <p className="text-sm font-medium text-gray-800">ノードを編集</p>

            {/* ラベル */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">テキスト</label>
              <input autoFocus value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveNodeEdit(); if (e.key === 'Escape') setEditingId(null) }}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            {/* ノードカラー */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">背景色</label>
              <div className="flex gap-2 flex-wrap">
                {NODE_COLORS.map(c => (
                  <button key={c.bg}
                    onClick={() => setEditColor(c.bg)}
                    title={c.label}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c.bg,
                      borderColor: editColor === c.bg ? '#374151' : c.border,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* サイズ */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">サイズ</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as NodeSize[]).map(s => (
                  <button key={s}
                    onClick={() => setEditSize(s)}
                    className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                      editSize === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={saveNodeEdit}
                className="flex-1 text-sm bg-gray-900 text-white py-1.5 rounded hover:bg-gray-700">
                保存
              </button>
              <button onClick={() => setEditingId(null)}
                className="flex-1 text-sm text-gray-500 py-1.5 rounded hover:bg-gray-100 border border-gray-200">
                キャンセル
              </button>
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
