'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'
import IconUploader from '@/components/IconUploader'

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setProjects(data)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), icon: null })
      .select()
      .single()
    if (!error && data) {
      await supabase.from('memos').insert({ project_id: data.id, title: 'メモ', content: '' })
      setProjects(prev => [data, ...prev])
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
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40"
            >
              作成
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-200"
            >
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
        <ul className="space-y-3">
          {projects.map(project => (
            <li key={project.id} className="group">
              <div className="flex items-center border border-gray-200 rounded-xl bg-white hover:border-gray-400 transition-colors px-4 py-3 gap-3">
                <div onClick={e => e.preventDefault()}>
                  <IconUploader
                    projectId={project.id}
                    iconUrl={project.icon ?? null}
                    projectName={project.name}
                    onChange={url => updateIcon(project.id, url)}
                  />
                </div>

                {renamingId === project.id ? (
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(project.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveRename(project.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                ) : (
                  <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{project.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(project.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </Link>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => startRename(project)}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    名前変更
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="text-gray-300 hover:text-red-400 text-xl leading-none px-1"
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
