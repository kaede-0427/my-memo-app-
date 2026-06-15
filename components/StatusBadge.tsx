'use client'

import type { Status } from '@/types/database'

const config: Record<Status, { label: string; className: string }> = {
  todo:        { label: '未着手',       className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  in_progress: { label: '進行中',       className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  on_hold:     { label: '保留',         className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  review:      { label: 'レビュー待ち', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  done:        { label: '完了',         className: 'bg-green-100 text-green-700 border border-green-200' },
}

export default function StatusBadge({ status }: { status: Status }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
