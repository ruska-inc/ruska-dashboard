'use client'

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortDir } from '@/lib/hooks/useSortable'

interface Props {
  label: string
  sortKey?: string
  currentKey?: string | null
  dir?: SortDir
  onSort?: (key: string) => void
  className?: string
}

export default function SortableTh({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  className,
}: Props) {
  const sortable = !!(sortKey && onSort)
  const active = sortable && currentKey === sortKey
  return (
    <th
      className={cn('text-left px-4 py-2 text-xs font-medium', className)}
      style={{ color: 'var(--muted)' }}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort!(sortKey!)}
          className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity select-none"
          style={{ color: active ? 'var(--primary)' : 'var(--muted)' }}
        >
          {label}
          {active && dir === 'asc' && <ChevronUp size={12} />}
          {active && dir === 'desc' && <ChevronDown size={12} />}
          {!active && <ChevronsUpDown size={12} className="opacity-30" />}
        </button>
      ) : (
        label
      )}
    </th>
  )
}
