'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { Contractor, ContractorAssignment, PaymentStatus } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (assignment: Omit<ContractorAssignment, 'id' | 'created_at' | 'contractor'>) => void
  contractors: Contractor[]
  initial?: ContractorAssignment
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

const PAYMENT_STATUSES: PaymentStatus[] = ['未対応', '確認中', '支払済']

export default function AssignmentFormModal({ open, onClose, onSave, contractors, initial }: Props) {
  const [form, setForm] = useState({
    contractor_id: initial?.contractor_id ?? contractors[0]?.id ?? '',
    project_name: initial?.project_name ?? '',
    amount_excl_tax: initial?.amount_excl_tax ?? 0,
    amount_incl_tax: initial?.amount_incl_tax ?? 0,
    invoice_month: initial?.invoice_month ?? '',
    payment_month: initial?.payment_month ?? '',
    payment_status: initial?.payment_status ?? '未対応' as PaymentStatus,
    notes: initial?.notes ?? '',
  })

  useEffect(() => {
    setForm({
      contractor_id: initial?.contractor_id ?? contractors[0]?.id ?? '',
      project_name: initial?.project_name ?? '',
      amount_excl_tax: initial?.amount_excl_tax ?? 0,
      amount_incl_tax: initial?.amount_incl_tax ?? 0,
      invoice_month: initial?.invoice_month ?? '',
      payment_month: initial?.payment_month ?? '',
      payment_status: initial?.payment_status ?? '未対応',
      notes: initial?.notes ?? '',
    })
  }, [open, initial])

  const handleAmountChange = (value: string) => {
    const amount = Number(value) || 0
    const contractor = contractors.find(c => c.id === form.contractor_id)
    const isTaxExempt = contractor?.invoice_status === '免税事業者'
    setForm(f => ({
      ...f,
      amount_excl_tax: amount,
      amount_incl_tax: isTaxExempt ? amount : Math.round(amount * 1.1),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...form,
      invoice_month: form.invoice_month || null,
      payment_month: form.payment_month || null,
      notes: form.notes || null,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '委託案件編集' : '委託案件追加'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>委託先 *</label>
          <select
            required
            value={form.contractor_id}
            onChange={e => setForm(f => ({ ...f, contractor_id: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          >
            {contractors.map(c => (
              <option key={c.id} value={c.id}>
                {c.company_name}（{c.contact_name}）
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>案件名 *</label>
          <input
            required
            value={form.project_name}
            onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            placeholder="例: ○○サイトコーディング"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>委託費用（税抜）</label>
            <input
              type="number"
              value={form.amount_excl_tax || ''}
              onChange={e => handleAmountChange(e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="0"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>委託費用（税込）</label>
            <input
              type="number"
              value={form.amount_incl_tax || ''}
              readOnly
              className={inputClass}
              style={{ ...inputStyle, background: '#F9FAFB', color: 'var(--muted)' }}
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>請求月</label>
            <input
              value={form.invoice_month}
              onChange={e => setForm(f => ({ ...f, invoice_month: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              placeholder="例: 2025年4月"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>支払月</label>
            <input
              value={form.payment_month}
              onChange={e => setForm(f => ({ ...f, payment_month: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              placeholder="例: 2025年5月"
            />
          </div>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>振込状況</label>
          <select
            value={form.payment_status}
            onChange={e => setForm(f => ({ ...f, payment_status: e.target.value as PaymentStatus }))}
            className={inputClass}
            style={inputStyle}
          >
            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>備考</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            rows={2}
            placeholder="メモや特記事項"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            {initial ? '更新する' : '追加する'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
