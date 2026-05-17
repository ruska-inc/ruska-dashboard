'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import type { BankAccount } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (input: { name: string; sort_order: number }) => void
  initial?: BankAccount
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

export default function AccountFormModal({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    sort_order: initial?.sort_order ?? 0,
  })

  useEffect(() => {
    setForm({ name: initial?.name ?? '', sort_order: initial?.sort_order ?? 0 })
  }, [open, initial])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '口座を編集' : '口座を追加'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>口座名 *</label>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            placeholder="例: 住信SBIネット銀行"
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>表示順</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >キャンセル</button>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >{initial ? '更新する' : '登録する'}</button>
        </div>
      </form>
    </Modal>
  )
}
