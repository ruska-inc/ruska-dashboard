'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Contractor, InvoiceStatus } from '@/lib/types'

const INVOICE_STATUSES: InvoiceStatus[] = ['登録済み', '免税事業者', '申請中', '未定']
const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Contractor, 'id' | 'created_at'>) => void
  initial?: Contractor
}

export default function ContractorFormModal({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? '',
    contact_name: initial?.contact_name ?? '',
    invoice_status: initial?.invoice_status ?? '未定' as InvoiceStatus,
    skills: initial?.skills.join(', ') ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    notes: initial?.notes ?? '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      company_name: form.company_name,
      contact_name: form.contact_name,
      invoice_status: form.invoice_status,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '委託先編集' : '委託先追加'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass} style={labelStyle}>団体名・会社名 *</label>
          <input required value={form.company_name}
            onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
            className={inputClass} style={inputStyle} placeholder="例: ○○デザイン事務所" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>担当者名 *</label>
          <input required value={form.contact_name}
            onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
            className={inputClass} style={inputStyle} placeholder="例: 山田 太郎" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>適格番号</label>
            <select value={form.invoice_status}
              onChange={e => setForm(f => ({ ...f, invoice_status: e.target.value as InvoiceStatus }))}
              className={inputClass} style={inputStyle}>
              {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>対応スキル（カンマ区切り）</label>
            <input value={form.skills}
              onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
              className={inputClass} style={inputStyle} placeholder="例: コーディング, WordPress" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>メールアドレス</label>
            <input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputClass} style={inputStyle} placeholder="example@email.com" />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>電話番号</label>
            <input value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className={inputClass} style={inputStyle} placeholder="090-0000-0000" />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>備考</label>
          <textarea value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className={inputClass} style={inputStyle} rows={2} />
        </div>
        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>キャンセル</button>
          <button type="submit"
            className="px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90"
            style={{ background: 'var(--primary)' }}>{initial ? '更新する' : '追加する'}</button>
        </div>
      </form>
    </Modal>
  )
}
