'use client'

import { useState, useRef, useEffect } from 'react'

const EMOJIS = [
  '📁','📂','🗂️','📋','📌','📍','🎯','🚀','💡','🔥',
  '⭐','🌟','💼','🏆','🎨','🎭','🎬','🎮','🎵','🎤',
  '📝','📊','📈','💻','📱','🔧','⚙️','🔬','🌍','🏠',
  '🏢','🚗','✈️','🌊','🌈','🍀','🌸','🦁','🐯','🦊',
  '❤️','💛','💚','💙','💜','🖤','🤍','🧡','💎','🔑',
]

interface Props {
  value: string
  onChange: (emoji: string) => void
}

export default function EmojiPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-2xl hover:scale-110 transition-transform leading-none"
        title="アイコンを変更"
      >
        {value}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-64">
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onChange(emoji); setOpen(false) }}
                className={`text-lg p-1 rounded hover:bg-gray-100 transition-colors ${value === emoji ? 'bg-gray-100' : ''}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
