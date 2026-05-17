'use client'

import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, Plus } from 'lucide-react'
import { bulkInsertBankTransactions, createBankAccount } from '@/lib/supabase/queries'
import { parseSpreadsheetTransactions, type SheetParsedTransaction } from '@/lib/cashflow/sheetParser'
import type { BankAccount, BankTransaction } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  accounts: BankAccount[]
  onImported: (txs: BankTransaction[], newAccounts: BankAccount[]) => void
}

const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }
const selectClass = 'w-full px-2 py-1.5 text-xs rounded-md border outline-none'
const selectStyle = { background: 'var(--card)', borderColor: 'var(--border)' }

export default function SheetImportModal({ open, onClose, accounts, onImported }: Props) {
  const [transactions, setTransactions] = useState<SheetParsedTransaction[]>([])
  const [detectedAccounts, setDetectedAccounts] = useState<string[]>([])
  const [sheetsScanned, setSheetsScanned] = useState<string[]>([])
  // 検出された口座名 → DB上のaccount_id or '__new' or '__skip'
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ count: number; created: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setTransactions([])
    setDetectedAccounts([])
    setSheetsScanned([])
    setMapping({})
    setError(null)
    setDone(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => { reset(); onClose() }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const result = await parseSpreadsheetTransactions(file)
      setTransactions(result.transactions)
      setDetectedAccounts(result.detectedAccounts)
      setSheetsScanned(result.sheetsScanned)
      // 自動マッピング: 既存口座と同名なら紐づけ、なければ '__new'
      const initialMapping: Record<string, string> = {}
      result.detectedAccounts.forEach(name => {
        const existing = accounts.find(a => a.name === name)
        initialMapping[name] = existing ? existing.id : '__new'
      })
      setMapping(initialMapping)
      if (result.transactions.length === 0) setError('取り込める取引データが見つかりませんでした')
    } catch (err) {
      setError((err as Error).message || 'ファイルの読み込みに失敗しました')
    }
  }

  const handleImport = async () => {
    if (transactions.length === 0) return
    setImporting(true)
    setError(null)
    try {
      // 1. '__new' のマッピングは新規口座作成
      const newAccountsMap: Record<string, BankAccount> = {}
      const createdAccounts: BankAccount[] = []
      for (const [name, target] of Object.entries(mapping)) {
        if (target === '__new') {
          const created = await createBankAccount({ name, sort_order: accounts.length + createdAccounts.length })
          newAccountsMap[name] = created
          createdAccounts.push(created)
        }
      }

      // 2. account_id 解決
      const resolve = (name: string): string | null => {
        const target = mapping[name]
        if (target === '__skip') return null
        if (target === '__new') return newAccountsMap[name]?.id ?? null
        return target
      }

      const inputs = transactions
        .map(t => {
          const accountId = resolve(t.accountName)
          if (!accountId) return null
          return {
            account_id: accountId,
            transaction_date: t.date,
            expense: t.expense,
            income: t.income,
            description: t.description,
            source: 'sheet_import' as const,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      const inserted = await bulkInsertBankTransactions(inputs)
      onImported(inserted, createdAccounts)
      setDone({ count: inserted.length, created: createdAccounts.length })
    } catch (err) {
      setError((err as Error).message || '取り込みに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  // マッピングを反映した取り込み対象数
  const importableCount = transactions.filter(t => mapping[t.accountName] !== '__skip').length

  return (
    <Modal open={open} onClose={handleClose} title="スプレッドシート一括インポート">
      {!done ? (
        <div className="space-y-4">
          <div className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(245,245,250,0.6)', color: 'var(--muted)' }}>
            既存のスプレッドシートをExcel(.xlsx)で書き出してアップロードしてください。
            「日付」列と「<span className="font-mono">口座名/費用</span>」「<span className="font-mono">口座名/収入</span>」のペア列を自動検出します。
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Excel/CSVファイル *</label>
            <div
              className="flex items-center gap-3 px-4 py-6 rounded-lg border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet size={20} style={{ color: 'var(--muted)' }} />
              <div className="flex-1">
                <p className="text-sm font-medium">クリックしてファイルを選択</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>.xlsx / .xls / .csv</p>
              </div>
              <Upload size={16} style={{ color: 'var(--muted)' }} />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
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

          {detectedAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold">検出されたシート: <span className="font-normal" style={{ color: 'var(--muted)' }}>{sheetsScanned.join(', ')}</span></p>
              <p className="text-xs font-semibold">口座マッピング</p>
              <div className="space-y-1.5 border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
                {detectedAccounts.map(name => {
                  const count = transactions.filter(t => t.accountName === name).length
                  return (
                    <div key={name} className="flex items-center gap-3 text-xs">
                      <div className="flex-1">
                        <span className="font-medium">{name}</span>
                        <span className="ml-2" style={{ color: 'var(--muted)' }}>{count}件</span>
                      </div>
                      <select
                        value={mapping[name] ?? ''}
                        onChange={e => setMapping(m => ({ ...m, [name]: e.target.value }))}
                        className={selectClass}
                        style={{ ...selectStyle, minWidth: 200 }}
                      >
                        <option value="__new">+ 新規作成「{name}」</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>既存口座: {a.name}</option>
                        ))}
                        <option value="__skip">スキップ</option>
                      </select>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>取り込み対象</p>
                  <p className="text-sm font-bold">{importableCount}件</p>
                </div>
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(220,252,231,0.5)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>入金合計</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                    {formatCurrency(transactions.filter(t => mapping[t.accountName] !== '__skip').reduce((s, t) => s + t.income, 0))}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(254,226,226,0.5)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>出金合計</p>
                  <p className="text-sm font-bold" style={{ color: '#EF4444' }}>
                    {formatCurrency(transactions.filter(t => mapping[t.accountName] !== '__skip').reduce((s, t) => s + t.expense, 0))}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >キャンセル</button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || importableCount === 0}
              className="px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {importing ? '取り込み中...' : `${importableCount}件を取り込む`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-center py-8">
          <CheckCircle size={48} className="mx-auto" style={{ color: 'var(--accent)' }} />
          <p className="font-semibold">{done.count}件の取引を取り込みました</p>
          {done.created > 0 && (
            <p className="text-sm flex items-center justify-center gap-1" style={{ color: 'var(--muted)' }}>
              <Plus size={12} />{done.created}件の新規口座を作成
            </p>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white"
            style={{ background: 'var(--primary)' }}
          >閉じる</button>
        </div>
      )}
    </Modal>
  )
}
