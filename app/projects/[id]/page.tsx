'use client'

import { useEffect, useState, useCallback, useRef, memo } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import type { Project, Memo, Task, Priority, Status } from '@/types/database'
import PriorityBadge from '@/components/PriorityBadge'
import StatusBadge from '@/components/StatusBadge'
import AddTaskForm from '@/components/AddTaskForm'
import IconUploader from '@/components/IconUploader'

const MindMapEditor = dynamic(() => import('@/components/MindMapEditor'), {
  ssr: false,
  loading: () => (
    <div className="mt-4 h-[520px] border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
      マインドマップを読み込み中...
    </div>
  ),
})

type MainTab = 'memo' | 'mindmap' | 'tasks'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'todo', label: '未着手' },
  { value: 'in_progress', label: '進行中' },
  { value: 'on_hold', label: '保留' },
  { value: 'review', label: 'レビュー待ち' },
  { value: 'done', label: '完了' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const TEXT_COLORS = [
  { label: 'デフォルト', value: '', cls: 'bg-gray-800' },
  { label: '赤', value: '#e53e3e', cls: 'bg-red-500' },
  { label: '青', value: '#3182ce', cls: 'bg-blue-500' },
  { label: '緑', value: '#38a169', cls: 'bg-green-600' },
  { label: 'オレンジ', value: '#dd6b20', cls: 'bg-orange-500' },
  { label: '紫', value: '#805ad5', cls: 'bg-purple-500' },
]

function GripIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className="text-gray-300">
      <circle cx="4" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="4" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="4" cy="11" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="11" r="1.2" fill="currentColor"/>
    </svg>
  )
}

// ---- Sortable Memo Tab ----
interface SortableMemoTabProps {
  memo: Memo
  isActive: boolean
  isRenaming: boolean
  renameRef: React.RefObject<HTMLInputElement | null>
  renameValue: string
  memoCount: number
  onSelect: () => void
  onRenameStart: () => void
  onRenameSave: (id: string) => void
  onRenameChange: (v: string) => void
  onRenameKeyDown: (e: React.KeyboardEvent, id: string) => void
  onDelete: (id: string) => void
}

function SortableMemoTab({
  memo, isActive, isRenaming, renameRef, renameValue, memoCount,
  onSelect, onRenameStart, onRenameSave, onRenameChange, onRenameKeyDown, onDelete,
}: SortableMemoTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: memo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style}
      className={`group flex items-center gap-0.5 flex-shrink-0 border-b-2 -mb-px transition-colors ${
        isActive ? 'border-gray-600 text-gray-800' : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}>
      <button {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 touch-none transition-opacity flex-shrink-0"
        tabIndex={-1}>
        <GripIcon size={10} />
      </button>
      {isRenaming ? (
        <input ref={renameRef} value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onBlur={() => onRenameSave(memo.id)}
          onKeyDown={e => onRenameKeyDown(e, memo.id)}
          className="text-sm border-b border-gray-400 bg-transparent focus:outline-none w-20 px-1 py-2"
        />
      ) : (
        <button onClick={onSelect} className="text-sm px-1.5 py-2.5 whitespace-nowrap">
          {memo.title}
        </button>
      )}
      <button onClick={onRenameStart}
        className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 text-xs transition-opacity px-0.5"
        title="名前を変更">✎</button>
      {memoCount > 1 && (
        <button onClick={() => onDelete(memo.id)}
          className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs transition-opacity pr-1">×</button>
      )}
    </div>
  )
}

// ---- Sortable Task ----
const SortableTask = memo(function SortableTask({
  task, onUpdate, onDelete,
}: {
  task: Task
  onUpdate: (t: Task) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState<Status>(task.status)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  async function save() {
    const { data, error } = await supabase
      .from('tasks').update({ title, status, priority, due_date: dueDate || null })
      .eq('id', task.id).select().single()
    if (!error && data) { onUpdate(data); setEditing(false) }
  }

  async function remove() {
    if (!confirm('このタスクを削除しますか？')) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onDelete(task.id)
  }

  async function toggleDone() {
    const next: Status = task.status === 'done' ? 'todo' : 'done'
    const { data, error } = await supabase
      .from('tasks').update({ status: next }).eq('id', task.id).select().single()
    if (!error && data) onUpdate(data)
  }

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
        <input autoFocus
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          value={title} onChange={e => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
            value={status} onChange={e => setStatus(e.target.value as Status)}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
            value={priority} onChange={e => setPriority(e.target.value as Priority)}>
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="date" className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
            value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700">保存</button>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-3 py-1 rounded hover:bg-gray-200">キャンセル</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-start gap-2 border border-gray-100 rounded-lg px-3 py-2.5 group hover:border-gray-300 transition-colors bg-white ${task.status === 'done' ? 'opacity-50' : ''}`}>
      <button {...attributes} {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none" tabIndex={-1}>
        <GripIcon />
      </button>
      <button onClick={toggleDone}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          task.status === 'done' ? 'bg-gray-800 border-gray-800' : 'border-gray-300 hover:border-gray-500'
        }`}>
        {task.status === 'done' && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
          {task.due_date && <span className="text-xs text-gray-400">{task.due_date}</span>}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 p-1">編集</button>
        <button onClick={remove} className="text-xs text-gray-400 hover:text-red-500 p-1">削除</button>
      </div>
    </div>
  )
})

// ---- Main Page ----
export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [memos, setMemos] = useState<Memo[]>([])
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [mainTab, setMainTab] = useState<MainTab>('memo')
  const [editingMemo, setEditingMemo] = useState(false)
  const [memoContent, setMemoContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  const [renamingMemoId, setRenamingMemoId] = useState<string | null>(null)
  const [renameMemoValue, setRenameMemoValue] = useState('')
  const renameMemoRef = useRef<HTMLInputElement>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    async function load() {
      const [projectRes, memosRes, tasksRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('memos').select('*').eq('project_id', id).order('updated_at', { ascending: true }),
        supabase.from('tasks').select('*').eq('project_id', id).order('position', { ascending: true }),
      ])
      if (projectRes.error || !projectRes.data) { router.push('/'); return }
      setProject(projectRes.data)
      setNameValue(projectRes.data.name)
      // position カラムが存在する場合はそれで並び替え、なければ updated_at 順をそのまま使う
      let loadedMemos: Memo[] = memosRes.data ?? []
      if (loadedMemos.length > 0 && loadedMemos[0].position !== undefined) {
        loadedMemos = [...loadedMemos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      }
      setMemos(loadedMemos)
      if (loadedMemos.length > 0) {
        setActiveMemoId(loadedMemos[0].id)
        setMemoContent(loadedMemos[0].content)
      }
      if (tasksRes.data) setTasks(tasksRes.data)
      setLoading(false)
    }
    load()
  }, [id, router])

  useEffect(() => { if (editingName) nameRef.current?.focus() }, [editingName])
  useEffect(() => { if (renamingMemoId) renameMemoRef.current?.focus() }, [renamingMemoId])

  const activeMemo = memos.find(m => m.id === activeMemoId) ?? null

  function switchMemo(memo: Memo) {
    if (editingMemo) return
    setActiveMemoId(memo.id)
    setMemoContent(memo.content)
  }

  const saveMemo = useCallback(async () => {
    if (!activeMemo) return
    setSaving(true)
    await supabase.from('memos').update({ content: memoContent }).eq('id', activeMemo.id)
    setMemos(prev => prev.map(m => m.id === activeMemo.id ? { ...m, content: memoContent } : m))
    setSaving(false)
    setEditingMemo(false)
  }, [activeMemo, memoContent])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editingMemo) {
        e.preventDefault()
        saveMemo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingMemo, saveMemo])

  function insertColor(color: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = memoContent.substring(start, end)
    const insertion = color
      ? `<span style="color:${color}">${selected || 'テキスト'}</span>`
      : selected
    const newContent = memoContent.substring(0, start) + insertion + memoContent.substring(end)
    setMemoContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + insertion.length
      ta.selectionEnd = start + insertion.length
    }, 0)
  }

  async function handleTaskDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)
    setTasks(reordered)
    await Promise.all(reordered.map((t, i) =>
      supabase.from('tasks').update({ position: i }).eq('id', t.id)
    ))
  }

  async function handleMemoTabDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = memos.findIndex(m => m.id === active.id)
    const newIndex = memos.findIndex(m => m.id === over.id)
    const reordered = arrayMove(memos, oldIndex, newIndex)
    setMemos(reordered)
    await Promise.all(reordered.map((m, i) =>
      supabase.from('memos').update({ position: i }).eq('id', m.id)
    ))
  }

  async function addMemoTab() {
    const { data, error } = await supabase
      .from('memos')
      .insert({ project_id: id, title: `ページ${memos.length + 1}`, content: '', position: memos.length })
      .select().single()
    if (!error && data) {
      setMemos(prev => [...prev, data])
      setActiveMemoId(data.id)
      setMemoContent('')
      setEditingMemo(false)
    }
  }

  async function deleteMemoTab(memoId: string) {
    if (memos.length <= 1) { alert('最後のページは削除できません'); return }
    if (!confirm('このページを削除しますか？')) return
    await supabase.from('memos').delete().eq('id', memoId)
    const remaining = memos.filter(m => m.id !== memoId)
    setMemos(remaining)
    if (activeMemoId === memoId) {
      setActiveMemoId(remaining[0].id)
      setMemoContent(remaining[0].content)
    }
  }

  async function saveMemoTitle(memoId: string) {
    const title = renameMemoValue.trim() || 'ページ'
    await supabase.from('memos').update({ title }).eq('id', memoId)
    setMemos(prev => prev.map(m => m.id === memoId ? { ...m, title } : m))
    setRenamingMemoId(null)
  }

  async function saveProjectName() {
    const name = nameValue.trim()
    if (!name || !project) { setEditingName(false); return }
    await supabase.from('projects').update({ name }).eq('id', project.id)
    setProject(prev => prev ? { ...prev, name } : prev)
    setEditingName(false)
  }

  async function updateProjectIcon(url: string) {
    if (!project) return
    await supabase.from('projects').update({ icon: url }).eq('id', project.id)
    setProject(prev => prev ? { ...prev, icon: url } : prev)
  }

  const handleTaskUpdate = useCallback((updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
  }, [])
  const handleTaskDelete = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [])
  const handleTaskAdd = useCallback((task: Task) => {
    setTasks(prev => [...prev, task])
  }, [])

  const doneTasks = tasks.filter(t => t.status === 'done')
  const activeTasks = tasks.filter(t => t.status !== 'done')

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-gray-400 text-sm">読み込み中...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-block">
          &larr; プロジェクト一覧
        </Link>
        <div className="flex items-center gap-3">
          <IconUploader
            projectId={project?.id ?? ''}
            iconUrl={project?.icon ?? null}
            projectName={project?.name ?? ''}
            onChange={updateProjectIcon}
          />
          {editingName ? (
            <input ref={nameRef} value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={saveProjectName}
              onKeyDown={e => { if (e.key === 'Enter') saveProjectName(); if (e.key === 'Escape') setEditingName(false) }}
              className="text-2xl font-bold text-gray-900 border-b-2 border-gray-400 bg-transparent focus:outline-none flex-1"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 group cursor-pointer"
              onDoubleClick={() => setEditingName(true)}>
              {project?.name}
              <span className="text-sm font-normal text-gray-300 group-hover:text-gray-400 transition-colors"
                onClick={() => setEditingName(true)}>編集</span>
            </h1>
          )}
        </div>
      </div>

      {/* メインタブ */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'memo', label: 'メモ' },
          { key: 'tasks', label: `タスク（${tasks.length}）` },
          { key: 'mindmap', label: 'マインドマップ' },
        ] as { key: MainTab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              mainTab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* メモタブ */}
      {mainTab === 'memo' && (
        <div>
          {/* メモサブタブ（ドラッグ並び替え対応） */}
          <div className="flex items-center border-b border-gray-100 mb-4 overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMemoTabDragEnd}>
              <SortableContext items={memos.map(m => m.id)} strategy={horizontalListSortingStrategy}>
                {memos.map(memo => (
                  <SortableMemoTab
                    key={memo.id}
                    memo={memo}
                    isActive={activeMemoId === memo.id}
                    isRenaming={renamingMemoId === memo.id}
                    renameRef={renameMemoRef}
                    renameValue={renameMemoValue}
                    memoCount={memos.length}
                    onSelect={() => switchMemo(memo)}
                    onRenameStart={() => { setRenamingMemoId(memo.id); setRenameMemoValue(memo.title) }}
                    onRenameSave={saveMemoTitle}
                    onRenameChange={setRenameMemoValue}
                    onRenameKeyDown={(e, mid) => { if (e.key === 'Enter') saveMemoTitle(mid); if (e.key === 'Escape') setRenamingMemoId(null) }}
                    onDelete={deleteMemoTab}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button onClick={addMemoTab}
              className="text-gray-300 hover:text-gray-600 px-3 py-2 text-sm flex-shrink-0 transition-colors">
              + 追加
            </button>
          </div>

          {/* 文字色ツールバー（編集中のみ表示） */}
          {editingMemo && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-gray-400">文字色：</span>
              {TEXT_COLORS.map(c => (
                <button key={c.value}
                  onClick={() => insertColor(c.value)}
                  title={c.label}
                  className={`w-5 h-5 rounded-full ${c.cls} hover:scale-110 transition-transform flex-shrink-0 border border-white shadow-sm`}
                />
              ))}
              <span className="text-xs text-gray-300">（文字を選択してから色ボタンをクリック）</span>
            </div>
          )}

          {/* メモ本文 */}
          {editingMemo ? (
            <div className="space-y-3">
              <textarea ref={textareaRef} autoFocus value={memoContent}
                onChange={e => setMemoContent(e.target.value)}
                className="w-full min-h-[400px] border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
                placeholder="自由に書けます（Enterで改行）"
              />
              <div className="flex gap-2 items-center">
                <button onClick={saveMemo} disabled={saving}
                  className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  {saving ? '保存中...' : '保存'}
                </button>
                <button onClick={() => { setEditingMemo(false); setMemoContent(activeMemo?.content ?? '') }}
                  className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-200">
                  キャンセル
                </button>
                <span className="text-xs text-gray-400">Ctrl+S でも保存</span>
              </div>
            </div>
          ) : (
            <div onClick={() => setEditingMemo(true)}
              className="min-h-[200px] cursor-text border border-transparent hover:border-gray-200 rounded-lg px-1 py-1 transition-colors">
              {memoContent ? (
                <div className="prose text-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
                    {memoContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-300 text-sm">クリックしてメモを書く...</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* マインドマップタブ */}
      {mainTab === 'mindmap' && (
        <MindMapEditor projectId={id} />
      )}

      {/* タスクタブ */}
      {mainTab === 'tasks' && (
        <div className="space-y-2 mt-6">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
            <SortableContext items={activeTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {activeTasks.map(task => (
                <SortableTask key={task.id} task={task} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} />
              ))}
            </SortableContext>
          </DndContext>

          <AddTaskForm projectId={id} nextPosition={tasks.length} onAdd={handleTaskAdd} />

          {doneTasks.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none py-2">
                完了済み（{doneTasks.length}件）
              </summary>
              <div className="space-y-2 mt-2">
                {doneTasks.map(task => (
                  <SortableTask key={task.id} task={task} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} />
                ))}
              </div>
            </details>
          )}

          {tasks.length === 0 && (
            <p className="text-center text-gray-300 text-sm py-8">タスクがありません</p>
          )}
        </div>
      )}
    </div>
  )
}
