'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

function parseJpMonth(jp: string | null): { year: number; month: number } | null {
  if (!jp) return null
  const m = jp.match(/(\d+)年(\d+)月/)
  if (!m) return null
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) }
}

export default function MonthPicker({
  value,
  onChange,
  placeholder = '月を選択',
  className,
  style,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const parsed = parseJpMonth(value)
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const [displayYear, setDisplayYear] = useState(parsed?.year ?? currentYear)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    if (parsed) setDisplayYear(parsed.year)
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const popoverWidth = 280
      const left = Math.min(rect.left + window.scrollX, window.innerWidth - popoverWidth - 8)
      setPopoverPos({ top: rect.bottom + window.scrollY + 6, left })
    }
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapperRef.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (month: number) => {
    onChange(`${displayYear}年${month}月`)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 text-left flex items-center justify-between gap-2 transition-colors"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          color: value ? 'var(--foreground)' : 'var(--muted)',
          ...style,
        }}
      >
        <span className="flex items-center gap-2 truncate">
          <Calendar size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <span className="truncate">{value || placeholder}</span>
        </span>
        {value && (
          <span
            role="button"
            tabIndex={-1}
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
            style={{ color: 'var(--muted)' }}
            aria-label="クリア"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {mounted && open && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="rounded-xl shadow-2xl border bg-white"
          style={{
            position: 'absolute',
            top: popoverPos.top,
            left: popoverPos.left,
            width: 280,
            zIndex: 10000,
            borderColor: 'var(--border)',
          }}
        >
          {/* 年送り */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setDisplayYear(y => y - 1)}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--muted)' }}
              aria-label="前年"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDisplayYear(currentYear)}
              className="font-semibold text-sm px-3 py-1 rounded-md hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--foreground)' }}
            >
              {displayYear}年
            </button>
            <button
              type="button"
              onClick={() => setDisplayYear(y => y + 1)}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--muted)' }}
              aria-label="翌年"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* 月グリッド */}
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
              const isSelected = parsed?.year === displayYear && parsed?.month === month
              const isCurrent = displayYear === currentYear && month === currentMonth
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleSelect(month)}
                  className={cn(
                    'px-2 py-2.5 text-xs rounded-md transition-all',
                    !isSelected && 'hover:bg-gray-100',
                  )}
                  style={
                    isSelected
                      ? {
                          background: 'var(--primary)',
                          color: 'white',
                          fontWeight: 600,
                          boxShadow: '0 2px 6px rgba(99,102,241,0.4)',
                        }
                      : isCurrent
                      ? {
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }
                      : { color: 'var(--foreground)' }
                  }
                >
                  {month}月
                </button>
              )
            })}
          </div>

          {/* フッター */}
          <div
            className="flex gap-1 p-2"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => { onChange(`${currentYear}年${currentMonth}月`); setOpen(false) }}
              className="flex-1 px-2 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-colors font-medium"
              style={{ color: 'var(--accent)' }}
            >
              今月
            </button>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="flex-1 px-2 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              クリア
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
