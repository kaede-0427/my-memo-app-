'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'
import IconUploader from '@/components/IconUploader'

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
}

function SortableProject({
  project, renamingId, renameValue, renameRef,
  onStartRename, onSaveRename, onRenameChange, onRenameKeyDown,
  onDelete, onIconChange,
}: SortableProjectProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <li ref={setNodeRef} style={style}>
      <div className="flex items-center border border-gray-200 rounded-xl bg-white hover:border-gray-400 transition-colors px-3 py-3 gap-2 group">
        {/* ドラッグハンドル */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:text-gray-500 flex-shrink-0 touch-none"
          tabIndex={-1}
        >
          <GripIcon />
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

        {/* 名前 */}
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
          <Link href={`/projects/${project.id}`} className="flex-1 min-w-0 flex items-center py-1">
            <p className="font-medium text-gray-900 truncate">{project.name}</p>
          </Link>
        )}

        {/* 操作 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onStartRename(project)}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            名前変更
          </button>
          <button
            onClick={() => onDelete(project.id)}
            className="text-gray-300 hover:text-red-400 text-xl leading-none px-1"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  )
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (data) setProjects(data)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

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
      .select()
      .single()
    if (!error && data) {
      await supabase.from('memos').insert({ project_id: data.id, title: 'メモ', content: '' })
      setProjects(prev => [...prev, data])
      setNewName('')
      setShowForm(false)
    }
    setAdding(false)
  }

  async function deleteProject(id: string) {
    if (!confirm('このプロジェクトを削除しますか？\nメモとタスクもすべて削除されます。')) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
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
      <div className="flex items-center justify-between mb-8">
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
          <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-3" />
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
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
