'use client'

import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { createProject } from '@/lib/supabase/queries'
import { Project, ProjectStatus, ProjectProbability, Period } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onImported: (projects: Project[]) => void
}

type PreviewRow = {
  name: string
  client_name: string
  status: ProjectStatus
  probability: ProjectProbability
  amount: number
  tax_amount: number
  period: Period
  invoice_month: string | null
  payment_month: string | null
  notes: string | null
}

const VALID_STATUSES: ProjectStatus[] = ['見積もり中','進行中','外注','請求済み','着金済み','立て替え','完了済','失注']
const VALID_PROBS: ProjectProbability[] = ['確度（低）','確度（中）','確度（高）','確定','保留・トラブル有り','失注']
const VALID_PERIODS: Period[] = ['第1期','第2期','第3期','第4期','第5期']

function parseAmount(v: unknown): number {
  if (!v) return 0
  return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0
}

export default function ExcelImportModal({ open, onClose, onImported }: Props) {
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    const rows: PreviewRow[] = []
    const errs: string[] = []

    for (const sheetName of wb.SheetNames) {
      if (!sheetName.includes('プロジェクト')) continue
      const ws = wb.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      data.forEach((row, i) => {
        const name = String(row['プロジェクト名'] || '').trim()
        const client = String(row['顧客名'] || '').trim()
        if (!name || !client) return

        const status = VALID_STATUSES.includes(row['プロジェクトステータス'] as ProjectStatus)
          ? row['プロジェクトステータス'] as ProjectStatus : '見積もり中'
        const probability = VALID_PROBS.includes(row['確度'] as ProjectProbability)
          ? row['確度'] as ProjectProbability : '確度（中）'
        const period = VALID_PERIODS.includes(row['期'] as Period)
          ? row['期'] as Period : '第1期'
        const amount = parseAmount(row['金額（税抜）'])
        const tax = parseAmount(row['税額']) || Math.round(amount * 0.1)

        rows.push({
          name,
          client_name: client,
          status,
          probability,
          amount,
          tax_amount: tax,
          period,
          invoice_month: String(row['請求月'] || '').trim() || null,
          payment_month: String(row['支払月'] || '').trim() || null,
          notes: String(row['備考'] || '').trim() || null,
        })
      })
    }

    setPreview(rows)
    setErrors(errs)
    setDone(false)
  }

  const handleImport = async () => {
    setImporting(true)
    const imported: Project[] = []
    for (const row of preview) {
      try {
        const created = await createProject({ ...row, estimate_url: null, invoice_url: null, parent_id: null })
        imported.push(created)
      } catch {}
    }
    setImporting(false)
    setDone(true)
    onImported(imported)
  }

  const handleClose = () => {
    setPreview([])
    setErrors([])
    setDone(false)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Excelからインポート" size="lg">
      <div className="space-y-4">
        {/* ファイル選択 */}
        {!done && (
          <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border)' }}>
            <FileSpreadsheet size={28} style={{ color: 'var(--accent)' }} />
            <p className="text-sm font-medium">Excelファイルをクリックして選択</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              .xlsx形式 / 「プロジェクト一覧」シートを読み込みます
            </p>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
          </label>
        )}

        {/* プレビュー */}
        {preview.length > 0 && !done && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={15} style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-medium">{preview.length}件のデータを検出しました</p>
            </div>
            <div className="rounded-lg border overflow-auto max-h-52" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.45)', borderBottom: '1px solid var(--border)' }}>
                    {['プロジェクト名', '顧客名', 'ステータス', '確度', '金額'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-3 py-2 max-w-[160px] truncate">{row.name}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate">{row.client_name}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{row.probability}</td>
                      <td className="px-3 py-2">¥{row.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && (
                <p className="text-xs text-center py-2" style={{ color: 'var(--muted)' }}>
                  他 {preview.length - 10}件...
                </p>
              )}
            </div>
          </div>
        )}

        {/* 完了 */}
        {done && (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle size={32} style={{ color: 'var(--accent)' }} />
            <p className="font-medium">インポート完了</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{preview.length}件を追加しました</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            {done ? '閉じる' : 'キャンセル'}
          </button>
          {preview.length > 0 && !done && (
            <button onClick={handleImport} disabled={importing}
              className="px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}>
              {importing ? 'インポート中...' : `${preview.length}件をインポート`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
