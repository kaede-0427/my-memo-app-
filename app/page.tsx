'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import type { Project, Task, Priority, Status } from '@/types/database'
import IconUploader from '@/components/IconUploader'

const PRIORITY_SELECT_CLASS: Record<Priority, string> = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:    'bg-blue-100 text-blue-700 border-blue-200',
}

const STATUS_SELECT_CLASS: Record<Status, string> = {
  todo:        'bg-gray-100 text-gray-600 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  on_hold:     'bg-orange-100 text-orange-700 border-orange-200',
  review:      'bg-purple-100 text-purple-700 border-purple-200',
  done:        'bg-green-100 text-green-700 border-green-200',
}

// ---- Icons ----
function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-300">
      <circle cx="4" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="4" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="4" cy="11" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="11" r="1.2" fill="currentColor"/>
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
    </svg>
  )
}

// ---- Task row inside accordion ----
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'todo', label: '未着手' },
  { value: 'in_progress', label: '進行中' },
  { value: 'on_hold', label: '保留' },
  { value: 'review', label: 'レビュー待ち' },
  { value: 'done', label: '完了' },
]

function TaskRow({ task, onUpdate }: { task: Task; onUpdate: (t: Task) => void }) {
  const done = task.status === 'done'
  return (
    <div className={`flex items-center gap-2 py-1.5 ${done ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onUpdate({ ...task, status: done ? 'todo' : 'done' })}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          done ? 'bg-gray-800 border-gray-800' : 'border-gray-300 hover:border-gray-500'
        }`}
      >
        {done && <CheckIcon />}
      </button>
      <span className={`text-sm flex-1 min-w-0 truncate ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {task.title}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <select
          value={task.priority}
          onChange={e => onUpdate({ ...task, priority: e.target.value as Priority })}
          onClick={e => e.stopPropagation()}
          className={`text-xs px-1.5 py-0.5 rounded border cursor-pointer focus:outline-none font-medium ${PRIORITY_SELECT_CLASS[task.priority]}`}
        >
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <select
          value={task.status}
          onChange={e => onUpdate({ ...task, status: e.target.value as Status })}
          onClick={e => e.stopPropagation()}
          className={`text-xs px-1.5 py-0.5 rounded border cursor-pointer focus:outline-none font-medium ${STATUS_SELECT_CLASS[task.status]}`}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {task.due_date && <span className="text-xs text-gray-400">{task.due_date}</span>}
      </div>
    </div>
  )
}

// ---- Quick add form inside accordion ----
function QuickAddTask({ projectId, nextPosition, onAdd, onCancel }: {
  projectId: string
  nextPosition: number
  onAdd: (t: Task) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<Status>('todo')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .insert({ project_id: projectId, title: title.trim(), priority, status, position: nextPosition })
      .select().single()
    setLoading(false)
    if (!error && data) { onAdd(data); onCancel() }
  }

  return (
    <form onSubmit={submit} className="space-y-2 pt-1 border-t border-gray-100 mt-2">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="タスク名を入力"
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
      />
      <div className="flex flex-wrap gap-1.5 items-center">
        <select value={status} onChange={e => setStatus(e.target.value as Status)}
          className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
          className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none">
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <button type="submit" disabled={loading || !title.trim()}
          className="text-xs bg-gray-800 text-white px-2.5 py-1 rounded hover:bg-gray-700 disabled:opacity-40">
          追加
        </button>
        <button type="button" onClick={onCancel}
          className="text-xs text-gray-400 px-2 py-1 hover:text-gray-600">
          キャンセル
        </button>
      </div>
    </form>
  )
}

// ---- Sortable project row + accordion ----
interface SortableProjectProps {
  project: Project
  renamingId: string | null
  renameValue: string
  renameRef: React.RefObject<HTMLInputElement | null>
  onStartRename: (p: Project) => void
  onSaveRename: (id: string) => void
  onRenameChange: (v: string) => void
  onRenameKeyDown: (e: React.KeyboardEvent, id: string) => void
  onDelete: (id: string) => void
  onIconChange: (id: string, url: string) => void
  isExpanded: boolean
  onToggle: () => void
  tasks: Task[]
  onTaskUpdate: (t: Task) => void
  onTaskAdd: (t: Task) => void
}

function SortableProject({
  project, renamingId, renameValue, renameRef,
  onStartRename, onSaveRename, onRenameChange, onRenameKeyDown,
  onDelete, onIconChange,
  isExpanded, onToggle, tasks,
  onTaskUpdate, onTaskAdd,
}: SortableProjectProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const [showQuickAdd, setShowQuickAdd] = useState(false)

  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')

  return (
    <li ref={setNodeRef} style={style}>
      <div className={`border rounded-xl bg-white transition-colors overflow-hidden ${
        isExpanded ? 'border-gray-300' : 'border-gray-200 hover:border-gray-300'
      }`}>
        {/* プロジェクト行 */}
        <div className="flex items-center px-2 py-3 gap-1.5 group">
          {/* ドラッグハンドル */}
          <button {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:text-gray-500 flex-shrink-0 touch-none"
            tabIndex={-1}>
            <GripIcon />
          </button>

          {/* アコーディオン展開ボタン */}
          <button
            onClick={onToggle}
            className="p-1 flex-shrink-0 hover:bg-gray-100 rounded transition-colors"
            title={isExpanded ? 'タスクを閉じる' : 'タスクを開く'}
          >
            <ChevronIcon expanded={isExpanded} />
          </button>

          {/* アイコン */}
          <div onClick={e => e.stopPropagation()}>
            <IconUploader
              projectId={project.id}
              iconUrl={project.icon}
              projectName={project.name}
              onChange={url => onIconChange(project.id, url)}
            />
          </div>

          {/* プロジェクト名 */}
          {renamingId === project.id ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              onBlur={() => onSaveRename(project.id)}
              onKeyDown={e => onRenameKeyDown(e, project.id)}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          ) : (
            <Link href={`/projects/${project.id}`} className="flex-1 min-w-0 flex items-center gap-2 py-1">
              <p className="font-medium text-gray-900 truncate">{project.name}</p>
              {tasks.length > 0 && (
                <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                  {activeTasks.length > 0 ? `残り${activeTasks.length}件` : '完了'}
                </span>
              )}
            </Link>
          )}

          {/* 操作ボタン */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => onStartRename(project)}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
              名前変更
            </button>
            <button onClick={() => onDelete(project.id)}
              className="text-gray-300 hover:text-red-400 text-xl leading-none px-1">×</button>
          </div>
        </div>

        {/* タスクアコーディオン */}
        {isExpanded && (
          <div className="px-4 pb-3 border-t border-gray-100">
            <div className="pt-2 space-y-0.5">
              {activeTasks.length === 0 && doneTasks.length === 0 && !showQuickAdd && (
                <p className="text-xs text-gray-300 py-1">タスクがありません</p>
              )}
              {activeTasks.map(task => (
                <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />
              ))}
              {doneTasks.length > 0 && (
                <details className="mt-1">
                  <summary className="text-xs text-gray-400 cursor-pointer select-none py-1 hover:text-gray-600">
                    完了済み（{doneTasks.length}件）
                  </summary>
                  <div className="mt-1 space-y-0.5">
                    {doneTasks.map(task => (
                      <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />
                    ))}
                  </div>
                </details>
              )}
            </div>

            {showQuickAdd ? (
              <QuickAddTask
                projectId={project.id}
                nextPosition={tasks.length}
                onAdd={t => { onTaskAdd(t); setShowQuickAdd(false) }}
                onCancel={() => setShowQuickAdd(false)}
              />
            ) : (
              <button
                onClick={() => setShowQuickAdd(true)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                + タスクを追加
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

// ---- Home page ----
export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectTasks, setProjectTasks] = useState<Record<string, Task[]>>({})
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    async function load() {
      const { data: projectsData } = await supabase
        .from('projects').select('*').order('position', { ascending: true })

      if (projectsData) {
        setProjects(projectsData)
        if (projectsData.length > 0) {
          const { data: tasksData } = await supabase
            .from('tasks').select('*')
            .in('project_id', projectsData.map(p => p.id))
            .order('position', { ascending: true })

          if (tasksData) {
            const grouped: Record<string, Task[]> = {}
            tasksData.forEach(task => {
              if (!grouped[task.project_id]) grouped[task.project_id] = []
              grouped[task.project_id].push(task)
            })
            setProjectTasks(grouped)
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  function toggleProject(id: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleTaskUpdate(task: Task) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: task.status, priority: task.priority })
      .eq('id', task.id).select().single()
    if (!error && data) {
      setProjectTasks(prev => ({
        ...prev,
        [task.project_id]: (prev[task.project_id] || []).map(t => t.id === task.id ? data : t),
      }))
    }
  }

  function handleTaskAdd(projectId: string, task: Task) {
    setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), task],
    }))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = projects.findIndex(p => p.id === active.id)
    const newIndex = projects.findIndex(p => p.id === over.id)
    const reordered = arrayMove(projects, oldIndex, newIndex)
    setProjects(reordered)
    await Promise.all(reordered.map((p, i) =>
      supabase.from('projects').update({ position: i }).eq('id', p.id)
    ))
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), icon: null, position: projects.length })
      .select().single()
    if (!error && data) {
      await supabase.from('memos').insert({ project_id: data.id, title: 'メモ', content: '' })
      setProjects(prev => [...prev, data])
      setProjectTasks(prev => ({ ...prev, [data.id]: [] }))
      setNewName('')
      setShowForm(false)
    }
    setAdding(false)
  }

  async function deleteProject(id: string) {
    if (!confirm('このプロジェクトを削除しますか？\nメモとタスクもすべて削除されます。')) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setProjectTasks(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  async function updateIcon(id: string, url: string) {
    await supabase.from('projects').update({ icon: url }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, icon: url } : p))
  }

  function startRename(project: Project) {
    setRenamingId(project.id)
    setRenameValue(project.name)
  }

  async function saveRename(id: string) {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    await supabase.from('projects').update({ name }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
    setRenamingId(null)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') saveRename(id)
    if (e.key === 'Escape') setRenamingId(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">プロジェクト</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          + 新規プロジェクト
        </button>
      </div>

      {showForm && (
        <form onSubmit={addProject} className="mb-6 p-4 border border-gray-200 rounded-xl bg-white space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="プロジェクト名"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <p className="text-xs text-gray-400">※ アイコン画像は作成後にアップロードできます</p>
          <div className="flex gap-2">
            <button type="submit" disabled={adding || !newName.trim()}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40">
              作成
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-200">
              キャンセル
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">読み込み中...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-3"/>
          <p className="text-sm">プロジェクトがありません</p>
          <p className="text-xs mt-1">「+ 新規プロジェクト」から作成してください</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {projects.map(project => (
                <SortableProject
                  key={project.id}
                  project={project}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  renameRef={renameRef}
                  onStartRename={startRename}
                  onSaveRename={saveRename}
                  onRenameChange={setRenameValue}
                  onRenameKeyDown={handleRenameKeyDown}
                  onDelete={deleteProject}
                  onIconChange={updateIcon}
                  isExpanded={expandedProjects.has(project.id)}
                  onToggle={() => toggleProject(project.id)}
                  tasks={projectTasks[project.id] || []}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskAdd={task => handleTaskAdd(project.id, task)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
