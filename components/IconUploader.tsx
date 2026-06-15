'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  projectId: string
  iconUrl: string | null
  projectName: string
  onChange: (url: string) => void
}

export default function IconUploader({ projectId, iconUrl, projectName, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const initials = projectName.slice(0, 2) || '...'

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${projectId}.${ext}`
    const { error } = await supabase.storage
      .from('project-icons')
      .upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('project-icons').getPublicUrl(path)
      onChange(data.publicUrl)
    }
    setUploading(false)
    e.target.value = ''
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      title="クリックして画像を変更"
      className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center hover:opacity-70 transition-opacity border border-gray-200"
    >
      {uploading ? (
        <span className="text-xs text-gray-400">...</span>
      ) : iconUrl ? (
        <img src={iconUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-bold text-gray-400 select-none">{initials}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </button>
  )
}
