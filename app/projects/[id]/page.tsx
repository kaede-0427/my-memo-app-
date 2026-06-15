'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '@/lib/supabase'
import type { Project, Memo, Task, Priority } from '@/types/database'
import TaskItem from '@/components/TaskItem'
import AddTaskForm from '@/components/AddTaskForm'
import IconUploader from '@/components/IconUploader'

type MainTab = 'memo' | 'tasks'

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

  useEffect(() => {
    async function load() {
      const [projectRes, memosRes, tasksRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('memos').select('*').eq('project_id', id).order('updated_at', { ascending: true }),
        supabase.from('tasks').select('*').eq('project_id', id),
      ])
      if (projectRes.error || !projectRes.data) { router.push('/'); return }
      setProject(projectRes.data)
      setNameValue(projectRes.data.name)
      const loadedMemos: Memo[] = memosRes.data ?? []
      setMemos(loadedMemos)
      if (loadedMemos.length > 0) {
        setActiveMemoId(loadedMemos[0].id)
        setMemoContent(loadedMemos[0].content)
      }
      if (tasksRes.data) setTasks(sortTasks(tasksRes.data))
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

  async function addMemoTab() {
    const { data, error } = await supabase
      .from('memos')
      .insert({ project_id: id, title: `ページ${memos.length + 1}`, content: '' })
      .select()
      .single()
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

  function handleTaskUpdate(updated: Task) {
    setTasks(prev => sortTasks(prev.map(t => t.id === updated.id ? updated : t)))
  }
  function handleTaskDelete(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }
  function handleTaskAdd(task: Task) {
    setTasks(prev => sortTasks([...prev, task]))
  }

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
            <input
              ref={nameRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={saveProjectName}
              onKeyDown={e => {
                if (e.key === 'Enter') saveProjectName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="text-2xl font-bold text-gray-900 border-b-2 border-gray-400 bg-transparent focus:outline-none flex-1"
            />
          ) : (
            <h1
              className="text-2xl font-bold text-gray-900 cursor-pointer group flex items-center gap-2"
              onDoubleClick={() => setEditingName(true)}
              title="ダブルクリックで名前を変更"
            >
              {project?.name}
              <span
                className="text-sm font-normal text-gray-300 group-hover:text-gray-400 transition-colors"
                onClick={() => setEditingName(true)}
              >
                編集
              </span>
            </h1>
          )}
        </div>
      </div>

      {/* メインタブ */}
      <div className="flex border-b border-gray-200">
        {(['memo', 'tasks'] as MainTab[]).map(t => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              mainTab === t
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'memo' ? 'メモ' : `タスク（${tasks.length}）`}
          </button>
        ))}
      </div>

      {/* メモタブ */}
      {mainTab === 'memo' && (
        <div>
          {/* メモサブタブ */}
          <div className="flex items-center border-b border-gray-100 mb-4 overflow-x-auto">
            {memos.map(memo => (
              <div
                key={memo.id}
                className={`group flex items-center gap-1 flex-shrink-0 border-b-2 -mb-px transition-colors ${
                  activeMemoId === memo.id
                    ? 'border-gray-500 text-gray-800'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {renamingMemoId === memo.id ? (
                  <input
                    ref={renameMemoRef}
                    value={renameMemoValue}
                    onChange={e => setRenameMemoValue(e.target.value)}
                    onBlur={() => saveMemoTitle(memo.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveMemoTitle(memo.id)
                      if (e.key === 'Escape') setRenamingMemoId(null)
                    }}
                    className="text-sm border-b border-gray-400 bg-transparent focus:outline-none w-24 px-1 py-2"
                  />
                ) : (
                  <button
                    onClick={() => switchMemo(memo)}
                    onDoubleClick={() => { setRenamingMemoId(memo.id); setRenameMemoValue(memo.title) }}
                    className="text-sm px-3 py-2.5 whitespace-nowrap"
                    title="ダブルクリックで名前変更"
                  >
                    {memo.title}
                  </button>
                )}
                {memos.length > 1 && (
                  <button
                    onClick={() => deleteMemoTab(memo.id)}
                    className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 pr-1 text-xs transition-opacity"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addMemoTab}
              className="text-gray-300 hover:text-gray-600 px-3 py-2 text-sm flex-shrink-0 transition-colors"
            >
              + 追加
            </button>
          </div>

          {/* メモ本文 */}
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
                  onClick={() => { setEditingMemo(false); setMemoContent(activeMemo?.content ?? '') }}
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
            >
              {memoContent ? (
                <div className="prose text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{memoContent}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-300 text-sm">クリックしてメモを書く...</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* タスクタブ */}
      {mainTab === 'tasks' && (
        <div className="space-y-2 mt-6">
          {activeTasks.map(task => (
            <TaskItem key={task.id} task={task} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} />
          ))}
          <AddTaskForm projectId={id} onAdd={handleTaskAdd} />
          {doneTasks.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none py-2">
                完了済み（{doneTasks.length}件）
              </summary>
              <div className="space-y-2 mt-2">
                {doneTasks.map(task => (
                  <TaskItem key={task.id} task={task} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} />
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
