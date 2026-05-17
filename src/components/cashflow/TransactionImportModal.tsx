'use client'

import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { bulkInsertBankTransactions } from '@/lib/supabase/queries'
import { parseCsvFile, FORMAT_LABELS, type CsvFormat, type ParsedTransaction } from '@/lib/cashflow/csvParsers'
import type { BankAccount, BankTransaction } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  accounts: BankAccount[]
  onImported: (txs: BankTransaction[]) => void
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

export default function TransactionImportModal({ open, onClose, accounts, onImported }: Props) {
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '')
  const [format, setFormat] = useState<CsvFormat>('csv_sbi')
  const [preview, setPreview] = useState<ParsedTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPreview([])
    setError(null)
    setDone(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const txs = await parseCsvFile(file, format)
      setPreview(txs)
      if (txs.length === 0) setError('取引データが見つかりませんでした')
    } catch (err) {
      setError((err as Error).message || 'CSVのパースに失敗しました')
      setPreview([])
    }
  }

  const handleImport = async () => {
    if (!accountId) { setError('口座を選択してください'); return }
    if (preview.length === 0) { setError('取り込むデータがありません'); return }
    setImporting(true)
    try {
      const inputs = preview.map(p => ({
        account_id: accountId,
        transaction_date: p.date,
        expense: p.expense,
        income: p.income,
        description: p.description,
        source: format,
      }))
      const inserted = await bulkInsertBankTransactions(inputs)
      onImported(inserted)
      setDone(true)
    } catch (err) {
      setError((err as Error).message || '保存に失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const totalIncome = preview.reduce((s, t) => s + t.income, 0)
  const totalExpense = preview.reduce((s, t) => s + t.expense, 0)

  return (
    <Modal open={open} onClose={handleClose} title="入出金CSVインポート">
      {!done ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>口座 *</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">選択してください</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>CSV形式</label>
              <select
                value={format}
                onChange={e => { setFormat(e.target.value as CsvFormat); reset() }}
                className={inputClass}
                style={inputStyle}
              >
                {Object.entries(FORMAT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>CSVファイル *</label>
            <div
              className="flex items-center gap-3 px-4 py-6 rounded-lg border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet size={20} style={{ color: 'var(--muted)' }} />
              <div className="flex-1">
                <p className="text-sm font-medium">クリックしてCSVを選択</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{FORMAT_LABELS[format]} のCSVファイル</p>
              </div>
              <Upload size={16} style={{ color: 'var(--muted)' }} />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(254,226,226,0.6)' }}>
              <AlertCircle size={14} style={{ color: '#EF4444', marginTop: 2 }} />
              <p className="text-xs" style={{ color: '#B91C1C' }}>{error}</p>
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>件数</p>
                  <p className="text-sm font-bold">{preview.length}件</p>
                </div>
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(220,252,231,0.5)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>入金合計</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(254,226,226,0.5)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>出金合計</p>
                  <p className="text-sm font-bold" style={{ color: '#EF4444' }}>{formatCurrency(totalExpense)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)', maxHeight: 280, overflowY: 'auto' }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white" style={{ borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>日付</th>
                      <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>摘要</th>
                      <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>出金</th>
                      <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>入金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((t, i) => (
                      <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-3 py-1.5">{t.date}</td>
                        <td className="px-3 py-1.5 truncate max-w-[180px]">{t.description ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: t.expense > 0 ? '#EF4444' : 'var(--muted)' }}>
                          {t.expense > 0 ? formatCurrency(t.expense) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right" style={{ color: t.income > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                          {t.income > 0 ? formatCurrency(t.income) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || preview.length === 0 || !accountId}
              className="px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {importing ? '取り込み中...' : `${preview.length}件を取り込む`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-center py-8">
          <CheckCircle size={48} className="mx-auto" style={{ color: 'var(--accent)' }} />
          <p className="font-semibold">{preview.length}件の取引を取り込みました</p>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white"
            style={{ background: 'var(--primary)' }}
          >
            閉じる
          </button>
        </div>
      )}
    </Modal>
  )
}
