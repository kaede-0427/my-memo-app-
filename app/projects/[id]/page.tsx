'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '@/lib/supabase'
import type { Project, Memo, Task, Priority } from '@/types/database'
import TaskItem from '@/components/TaskItem'
import AddTaskForm from '@/components/AddTaskForm'

type Tab = 'memo' | 'tasks'

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pd !== 0) return pd
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return a.created_at.localeCompare(b.created_at)
  })
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [memo, setMemo] = useState<Memo | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [tab, setTab] = useState<Tab>('memo')
  const [memoContent, setMemoContent] = useState('')
  const [editingMemo, setEditingMemo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [projectRes, memoRes, tasksRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('memos').select('*').eq('project_id', id).single(),
        supabase.from('tasks').select('*').eq('project_id', id),
      ])
      if (projectRes.error || !projectRes.data) { router.push('/'); return }
      setProject(projectRes.data)
      if (memoRes.data) {
        setMemo(memoRes.data)
        setMemoContent(memoRes.data.content)
      }
      if (tasksRes.data) setTasks(sortTasks(tasksRes.data))
      setLoading(false)
    }
    load()
  }, [id, router])

  const saveMemo = useCallback(async () => {
    if (!memo) return
    setSaving(true)
    await supabase.from('memos').update({ content: memoContent }).eq('id', memo.id)
    setSaving(false)
    setEditingMemo(false)
  }, [memo, memoContent])

  // Ctrl+S でメモ保存
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

  function handleTaskUpdate(updated: Task) {
    setTasks(prev => sortTasks(prev.map(t => t.id === updated.id ? updated : t)))
  }

  function handleTaskDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function handleTaskAdd(task: Task) {
    setTasks(prev => sortTasks([...prev, task]))
  }

  const doneTasks = tasks.filter(t => t.status === 'done')
  const activeTasks = tasks.filter(t => t.status !== 'done')

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-gray-400 text-sm">読み込み中...</div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← プロジェクト一覧
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['memo', 'tasks'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'memo' ? 'メモ' : `タスク（${tasks.length}）`}
          </button>
        ))}
      </div>

      {/* メモタブ */}
      {tab === 'memo' && (
        <div>
          {editingMemo ? (
            <div className="space-y-3">
              <textarea
                autoFocus
                value={memoContent}
                onChange={e => setMemoContent(e.target.value)}
                className="w-full min-h-[400px] border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
                placeholder="マークダウンで書けます&#10;&#10;## 見出し&#10;- リスト&#10;**太字**"
              />
              <div className="flex gap-2 items-center">
                <button
                  onClick={saveMemo}
                  disabled={saving}
                  className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => { setEditingMemo(false); setMemoContent(memo?.content ?? '') }}
                  className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-200"
                >
                  キャンセル
                </button>
                <span className="text-xs text-gray-400">Ctrl+S でも保存</span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingMemo(true)}
              className="min-h-[200px] cursor-text border border-transparent hover:border-gray-200 rounded-lg px-1 py-1 transition-colors"
              title="クリックして編集"
            >
              {memoContent ? (
                <div className="prose text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
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

      {/* タスクタブ */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          {activeTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdate={handleTaskUpdate}
              onDelete={handleTaskDelete}
            />
          ))}

          <AddTaskForm projectId={id} onAdd={handleTaskAdd} />

          {doneTasks.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none py-2">
                完了済み（{doneTasks.length}件）
              </summary>
              <div className="space-y-2 mt-2">
                {doneTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onUpdate={handleTaskUpdate}
                    onDelete={handleTaskDelete}
                  />
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
