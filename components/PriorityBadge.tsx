'use client'

import type { Priority } from '@/types/database'

const config: Record<Priority, { label: string; className: string }> = {
  high:   { label: '高', className: 'bg-red-100 text-red-700 border border-red-200' },
  medium: { label: '中', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  low:    { label: '低', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
}

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, className } = config[priority]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
