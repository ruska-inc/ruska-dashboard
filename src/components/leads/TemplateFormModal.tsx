'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import type { EmailTemplate } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (input: { name: string; subject: string; body: string; is_default: boolean; sort_order: number }) => void
  initial?: EmailTemplate
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

export default function TemplateFormModal({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    subject: initial?.subject ?? '',
    body: initial?.body ?? '',
    is_default: initial?.is_default ?? false,
    sort_order: initial?.sort_order ?? 0,
  })

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      subject: initial?.subject ?? '',
      body: initial?.body ?? '',
      is_default: initial?.is_default ?? false,
      sort_order: initial?.sort_order ?? 0,
    })
  }, [open, initial])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'テンプレートを編集' : 'テンプレートを追加'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>テンプレート名 *</label>
          <input required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputClass} style={inputStyle}
            placeholder="例: 初回アプローチ" />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>件名 *</label>
          <input required value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            className={inputClass} style={inputStyle}
            placeholder="{{company_name}}様 - サービスのご紹介" />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>本文 *</label>
          <textarea required value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            className={inputClass} style={{ ...inputStyle, minHeight: 240, fontFamily: 'monospace' }}
            placeholder="{{contact_person_name}}様&#10;&#10;お世話になっております。..." />
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            差し込み変数: <code>{'{{company_name}}'}</code> / <code>{'{{contact_person_name}}'}</code> /
            <code>{'{{address}}'}</code> / <code>{'{{industry}}'}</code> / <code>{'{{url}}'}</code>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>表示順</label>
            <input type="number" value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
              className={inputClass} style={inputStyle} />
          </div>
          <label className="flex items-end gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={form.is_default}
              onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
            デフォルトテンプレート
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>キャンセル</button>
          <button type="submit"
            className="px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90"
            style={{ background: 'var(--primary)' }}>
            {initial ? '更新する' : '登録する'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
