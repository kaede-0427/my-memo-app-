'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, Status, Priority } from '@/types/database'
import PriorityBadge from './PriorityBadge'
import StatusBadge from './StatusBadge'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'todo',        label: '未着手' },
  { value: 'in_progress', label: '進行中' },
  { value: 'on_hold',     label: '保留' },
  { value: 'review',      label: 'レビュー待ち' },
  { value: 'done',        label: '完了' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high',   label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low',    label: '低' },
]

interface Props {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (id: string) => void
}

export default function TaskItem({ task, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState<Status>(task.status)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')

  async function save() {
    const { data, error } = await supabase
      .from('tasks')
      .update({ title, status, priority, due_date: dueDate || null })
      .eq('id', task.id)
      .select()
      .single()
    if (!error && data) {
      onUpdate(data)
      setEditing(false)
    }
  }

  async function remove() {
    if (!confirm('このタスクを削除しますか？')) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onDelete(task.id)
  }

  async function toggleDone() {
    const next: Status = task.status === 'done' ? 'todo' : 'done'
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: next })
      .eq('id', task.id)
      .select()
      .single()
    if (!error && data) onUpdate(data)
  }

  if (editing) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
        <input
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="タスク名"
        />
        <div className="flex flex-wrap gap-2">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
            value={status}
            onChange={e => setStatus(e.target.value as Status)}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
          >
            {PRIORITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="date"
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700">保存</button>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-3 py-1 rounded hover:bg-gray-200">キャンセル</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 border border-gray-100 rounded-lg px-3 py-2.5 group hover:border-gray-300 transition-colors ${task.status === 'done' ? 'opacity-50' : ''}`}>
      <button
        onClick={toggleDone}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          task.status === 'done'
            ? 'bg-gray-800 border-gray-800'
            : 'border-gray-300 hover:border-gray-500'
        }`}
      >
        {task.status === 'done' && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
          {task.due_date && (
            <span className="text-xs text-gray-400">{task.due_date}</span>
          )}
        </div>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 p-1">
          編集
        </button>
        <button onClick={remove} className="text-xs text-gray-400 hover:text-red-500 p-1">
          削除
        </button>
      </div>
    </div>
  )
}
