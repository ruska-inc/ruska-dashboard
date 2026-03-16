'use client'

import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl shadow-xl p-5"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(254,226,226,0.70)' }}>
            <AlertTriangle size={16} style={{ color: '#EF4444' }} />
          </div>
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            キャンセル
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: '#EF4444' }}>
            削除する
          </button>
        </div>
      </div>
    </div>
  )
}
