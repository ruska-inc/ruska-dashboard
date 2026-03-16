'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { Project, ProjectStatus, ProjectProbability, Period, Client } from '@/lib/types'
import { usePeriods } from '@/lib/hooks/usePeriods'
import { getClients, createClientRecord } from '@/lib/supabase/queries'

const STATUSES: ProjectStatus[] = [
  '見積もり中', '進行中', '外注', '請求済み', '着金済み', '立て替え', '完了済', '失注'
]
const PROBABILITIES: ProjectProbability[] = [
  '確度（低）', '確度（中）', '確度（高）', '確定', '保留・トラブル有り', '失注'
]

interface Props {
  open: boolean
  onClose: () => void
  onSave: (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => void
  initial?: Project
}

const inputClass = `w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-offset-0`
const inputStyle = {
  background: 'var(--card)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
}
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

export default function ProjectFormModal({ open, onClose, onSave, initial }: Props) {
  const { periods: periodSettings } = usePeriods()
  const PERIODS = periodSettings.map(p => p.name)
  const [clients, setClients] = useState<Client[]>([])
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)

  useEffect(() => {
    getClients().then(setClients).catch(() => {})
  }, [])

  const handleAddClient = async () => {
    const name = newClientName.trim()
    if (!name) return
    setAddingClient(true)
    try {
      const created = await createClientRecord(name)
      setClients(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, client_name: created.name }))
      setNewClientName('')
    } finally {
      setAddingClient(false)
    }
  }

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    client_name: initial?.client_name ?? '',
    status: initial?.status ?? '見積もり中' as ProjectStatus,
    probability: initial?.probability ?? '確度（中）' as ProjectProbability,
    amount: initial?.amount ?? 0,
    tax_amount: initial?.tax_amount ?? 0,
    period: initial?.period ?? '第4期' as Period,
    invoice_month: initial?.invoice_month ?? '',
    payment_month: initial?.payment_month ?? '',
    notes: initial?.notes ?? '',
    estimate_url: initial?.estimate_url ?? '',
    invoice_url: initial?.invoice_url ?? '',
    parent_id: initial?.parent_id ?? null,
  })

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      client_name: initial?.client_name ?? '',
      status: initial?.status ?? '見積もり中',
      probability: initial?.probability ?? '確度（中）',
      amount: initial?.amount ?? 0,
      tax_amount: initial?.tax_amount ?? 0,
      period: initial?.period ?? '第4期',
      invoice_month: initial?.invoice_month ?? '',
      payment_month: initial?.payment_month ?? '',
      notes: initial?.notes ?? '',
      estimate_url: initial?.estimate_url ?? '',
      invoice_url: initial?.invoice_url ?? '',
      parent_id: initial?.parent_id ?? null,
    })
  }, [open, initial])

  const handleAmountChange = (value: string) => {
    const amount = Number(value) || 0
    setForm(f => ({ ...f, amount, tax_amount: Math.round(amount * 0.1) }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...form,
      invoice_month: form.invoice_month || null,
      payment_month: form.payment_month || null,
      notes: form.notes || null,
      estimate_url: form.estimate_url || null,
      invoice_url: form.invoice_url || null,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'プロジェクト編集' : 'プロジェクト新規追加'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* プロジェクト名 */}
          <div className="col-span-2">
            <label className={labelClass} style={labelStyle}>プロジェクト名 *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              placeholder="例: ○○社サイトリニューアル"
            />
          </div>

          {/* 顧客名 */}
          <div className="col-span-2">
            <label className={labelClass} style={labelStyle}>顧客名 *</label>
            <div className="flex gap-2">
              <select
                required
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">顧客を選択...</option>
                {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddClient())}
                className={inputClass}
                style={{ ...inputStyle, fontSize: '0.75rem' }}
                placeholder="新しい顧客名を追加..."
              />
              <button
                type="button"
                onClick={handleAddClient}
                disabled={addingClient || !newClientName.trim()}
                className="px-3 py-2 text-xs rounded-lg font-medium text-white disabled:opacity-50 shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                追加
              </button>
            </div>
          </div>

          {/* ステータス */}
          <div>
            <label className={labelClass} style={labelStyle}>ステータス</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
              className={inputClass}
              style={inputStyle}
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* 確度 */}
          <div>
            <label className={labelClass} style={labelStyle}>確度</label>
            <select
              value={form.probability}
              onChange={e => setForm(f => ({ ...f, probability: e.target.value as ProjectProbability }))}
              className={inputClass}
              style={inputStyle}
            >
              {PROBABILITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* 金額（税抜） */}
          <div>
            <label className={labelClass} style={labelStyle}>金額（税抜）</label>
            <input
              type="number"
              value={form.amount || ''}
              onChange={e => handleAmountChange(e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="0"
            />
          </div>

          {/* 税額（自動計算） */}
          <div>
            <label className={labelClass} style={labelStyle}>税額（10%自動計算）</label>
            <input
              type="number"
              value={form.tax_amount || ''}
              readOnly
              className={inputClass}
              style={{ ...inputStyle, background: 'rgba(255,255,255,0.35)', color: 'var(--muted)' }}
            />
          </div>

          {/* 期 */}
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

          {/* 請求月 */}
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

          {/* 支払月 */}
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

          {/* 備考 */}
          <div className="col-span-2">
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
        </div>

        {/* ボタン */}
        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-lg font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            {initial ? '更新する' : '追加する'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
