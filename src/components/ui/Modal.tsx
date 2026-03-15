'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* モーダル本体 */}
      <div
        className={cn('relative w-full rounded-xl shadow-xl', widths[size])}
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: 'var(--muted)' }}
          >
            <X size={15} />
          </button>
        </div>
        {/* コンテンツ */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
