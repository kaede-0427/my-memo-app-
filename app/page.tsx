'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

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

  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: newName.trim() })
      .select()
      .single()
    if (!error && data) {
      await supabase.from('memos').insert({ project_id: data.id, content: '' })
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
        <form onSubmit={addProject} className="mb-6 flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="プロジェクト名"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
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
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">読み込み中...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-sm">プロジェクトがありません</p>
          <p className="text-xs mt-1">「+ 新規プロジェクト」から作成してください</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map(project => (
            <li key={project.id} className="group">
              <div className="flex items-center border border-gray-200 rounded-xl bg-white hover:border-gray-400 transition-colors">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex-1 px-5 py-4"
                >
                  <p className="font-medium text-gray-900">{project.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(project.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </Link>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="pr-4 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xl leading-none"
                  title="削除"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
