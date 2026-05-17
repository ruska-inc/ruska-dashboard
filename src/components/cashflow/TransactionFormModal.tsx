'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import type { BankAccount, BankTransaction } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  accounts: BankAccount[]
  onSave: (input: Omit<BankTransaction, 'id' | 'created_at' | 'account'>) => void
  initial?: BankTransaction
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

export default function TransactionFormModal({ open, onClose, accounts, onSave, initial }: Props) {
  const [form, setForm] = useState({
    account_id: initial?.account_id ?? accounts[0]?.id ?? '',
    transaction_date: initial?.transaction_date ?? '',
    expense: initial?.expense ?? 0,
    income: initial?.income ?? 0,
    description: initial?.description ?? '',
  })

  useEffect(() => {
    setForm({
      account_id: initial?.account_id ?? accounts[0]?.id ?? '',
      transaction_date: initial?.transaction_date ?? '',
      expense: initial?.expense ?? 0,
      income: initial?.income ?? 0,
      description: initial?.description ?? '',
    })
  }, [open, initial, accounts])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      account_id: form.account_id,
      transaction_date: form.transaction_date,
      expense: form.expense,
      income: form.income,
      description: form.description || null,
      source: initial?.source ?? 'manual',
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '取引を編集' : '取引を追加'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>口座 *</label>
            <select
              required
              value={form.account_id}
              onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">選択</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>日付 *</label>
            <input
              required
              type="date"
              value={form.transaction_date}
              onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>出金額</label>
            <input
              type="number"
              value={form.expense || ''}
              onChange={e => setForm(f => ({ ...f, expense: Number(e.target.value) || 0 }))}
              className={inputClass}
              style={inputStyle}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>入金額</label>
            <input
              type="number"
              value={form.income || ''}
              onChange={e => setForm(f => ({ ...f, income: Number(e.target.value) || 0 }))}
              className={inputClass}
              style={inputStyle}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>摘要</label>
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            placeholder="例: 給与振込・水道光熱費"
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
            {initial ? '更新する' : '登録する'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
