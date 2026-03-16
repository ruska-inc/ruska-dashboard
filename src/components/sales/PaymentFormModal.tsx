'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { PaymentRecord, Period } from '@/lib/types'
import { usePeriods } from '@/lib/hooks/usePeriods'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (record: Omit<PaymentRecord, 'id' | 'created_at'>) => void
  initial?: PaymentRecord
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

export default function PaymentFormModal({ open, onClose, onSave, initial }: Props) {
  const { periods: periodSettings } = usePeriods()
  const PERIODS = periodSettings.map(p => p.name)

  const [form, setForm] = useState({
    project_id: initial?.project_id ?? '',
    project_name: initial?.project_name ?? '',
    client_name: initial?.client_name ?? '',
    payment_date: initial?.payment_date ?? '',
    amount: initial?.amount ?? 0,
    payment_month: initial?.payment_month ?? '',
    period: initial?.period ?? '第4期' as Period,
  })

  useEffect(() => {
    setForm({
      project_id: initial?.project_id ?? '',
      project_name: initial?.project_name ?? '',
      client_name: initial?.client_name ?? '',
      payment_date: initial?.payment_date ?? '',
      amount: initial?.amount ?? 0,
      payment_month: initial?.payment_month ?? '',
      period: initial?.period ?? '第4期',
    })
  }, [open, initial])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ ...form, project_id: form.project_id || null })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '入金記録編集' : '入金登録'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>プロジェクト名 *</label>
          <input
            required
            value={form.project_name}
            onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            placeholder="例: ○○サイトリニューアル"
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>顧客名 *</label>
          <input
            required
            value={form.client_name}
            onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            placeholder="例: 株式会社○○"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>入金日 *</label>
            <input
              required
              type="date"
              value={form.payment_date}
              onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>入金額 *</label>
            <input
              required
              type="number"
              value={form.amount || ''}
              onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
              className={inputClass}
              style={inputStyle}
              placeholder="0"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>入金月</label>
            <input
              value={form.payment_month}
              onChange={e => setForm(f => ({ ...f, payment_month: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              placeholder="例: 2025年4月"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>期</label>
            <select
              value={form.period}
              onChange={e => setForm(f => ({ ...f, period: e.target.value as Period }))}
              className={inputClass}
              style={inputStyle}
            >
              {PERIODS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
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
            {initial ? '更新する' : '登録する'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
