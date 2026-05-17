'use client'

import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'
export type SortAccessor<T> = (item: T) => string | number | null | undefined

// "2025年5月" → 202505 のようにソート可能な数値へ
export function monthSortValue(s: string | null | undefined): number {
  if (!s) return 0
  const m = s.match(/(\d+)年(\d+)月/)
  if (!m) return 0
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10)
}

export function useSortable<T>(
  items: T[],
  accessors: Record<string, SortAccessor<T>>,
  initial?: { key: string; dir?: SortDir },
) {
  const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? 'asc')

  const sorted = useMemo(() => {
    if (!sortKey) return items
    const accessor = accessors[sortKey]
    if (!accessor) return items
    return [...items].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv), 'ja')
      return sortDir === 'asc' ? cmp : -cmp
    })
    // accessors is intentionally omitted: inline-defined functions would force
    // a re-sort on every render but produce identical results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortKey, sortDir])

  const toggle = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return { sorted, sortKey, sortDir, toggle }
}
