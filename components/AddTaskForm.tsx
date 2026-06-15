'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, Priority } from '@/types/database'

interface Props {
  projectId: string
  onAdd: (task: Task) => void
}

export default function AddTaskForm({ projectId, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .insert({ project_id: projectId, title: title.trim(), priority, due_date: dueDate || null })
      .select()
      .single()
    setLoading(false)
    if (!error && data) {
      onAdd(data)
      setTitle('')
      setPriority('medium')
      setDueDate('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 hover:border-gray-400 rounded-lg px-3 py-2.5 transition-colors"
      >
        + タスクを追加
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="border border-gray-300 rounded-lg p-3 space-y-2 bg-gray-50">
      <input
        autoFocus
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        placeholder="タスク名を入力"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <select
          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
          value={priority}
          onChange={e => setPriority(e.target.value as Priority)}
        >
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <input
          type="date"
          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-40"
        >
          追加
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 px-3 py-1 rounded hover:bg-gray-200"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
