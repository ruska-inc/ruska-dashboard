'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/Badge'
import { AlertCircle, CheckCircle, Download, RefreshCw, FileText, FileCheck2 } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { Project } from '@/lib/types'
import type { SyncRow } from '@/lib/moneyforward/mapping'
import { usePeriods } from '@/lib/hooks/usePeriods'

interface Props {
  open: boolean
  onClose: () => void
  onImported: (result: { created: Project[]; updated: Project[] }) => void
}

interface PreviewResult {
  range: { from: string; to: string }
  quotes_fetched: number
  billings_fetched: number
  summary: { create: number; update: number; unchanged: number }
  rows: SyncRow[]
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 期の設定が読めるまでの暫定値（過去2年） */
function defaultRange() {
  const to = new Date()
  const from = new Date(to.getFullYear() - 2, to.getMonth(), 1)
  return { from: fmtDate(from), to: fmtDate(to) }
}

const ACTION_LABEL: Record<SyncRow['action'], string> = {
  create: '新規',
  update: '更新',
  unchanged: '変更なし',
}
const ACTION_STYLE: Record<SyncRow['action'], string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  unchanged: 'bg-gray-50 text-gray-500 border-gray-200',
}
const MATCHED_BY_LABEL: Record<string, string> = {
  mf_billing_id: '請求書IDで一致',
  mf_quote_id: '見積書IDで一致',
  title: '取引先＋件名で一致',
}

export default function MFSyncModal({ open, onClose, onImported }: Props) {
  const [range, setRange] = useState(defaultRange)
  const [rangeTouched, setRangeTouched] = useState(false)
  const { periods } = usePeriods()

  // 取得漏れを防ぐため、最初の期の開始月を既定の開始日にする
  useEffect(() => {
    if (rangeTouched) return
    const earliest = periods
      .map(p => p.start_year_month)
      .filter((m): m is string => !!m)
      .sort()[0]
    if (!earliest) return
    setRange(r => (r.from === `${earliest}-01` ? r : { ...r, from: `${earliest}-01` }))
  }, [periods, rangeTouched])
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)
  const [done, setDone] = useState<{ created: number; updated: number; failures: number } | null>(null)

  const reset = useCallback(() => {
    setPreview(null)
    setSelected(new Set())
    setError(null)
    setNotConnected(false)
    setDone(null)
  }, [])

  const handleClose = () => {
    reset()
    onClose()
  }

  const loadPreview = async () => {
    setLoading(true)
    setError(null)
    setNotConnected(false)
    setDone(null)
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to })
      const res = await fetch(`/api/moneyforward/sync?${params}`)
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 401) setNotConnected(true)
        throw new Error(json.error ?? `取得に失敗しました (${res.status})`)
      }
      const result = json as PreviewResult
      setPreview(result)
      // 変更のある行を既定で選択
      setSelected(new Set(result.rows.filter(r => r.action !== 'unchanged').map(r => r.key)))
    } catch (e) {
      setError((e as Error).message)
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const apply = async () => {
    if (!preview || selected.size === 0) return
    setApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/moneyforward/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: range.from, to: range.to, keys: [...selected] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `取り込みに失敗しました (${res.status})`)
      onImported({ created: json.created ?? [], updated: json.updated ?? [] })
      setDone({
        created: json.created_count ?? 0,
        updated: json.updated_count ?? 0,
        failures: (json.failures ?? []).length,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const changeableRows = preview?.rows.filter(r => r.action !== 'unchanged') ?? []
  const allSelected = changeableRows.length > 0 && changeableRows.every(r => selected.has(r.key))
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(changeableRows.map(r => r.key)))
  }

  const selectedAmount = (preview?.rows ?? [])
    .filter(r => selected.has(r.key))
    .reduce((s, r) => s + r.amount, 0)

  return (
    <Modal open={open} onClose={handleClose} title="マネーフォワードから取り込み" size="lg">
      {done ? (
        <div className="space-y-3 text-center py-8">
          <CheckCircle size={48} className="mx-auto" style={{ color: 'var(--accent)' }} />
          <p className="font-semibold">
            新規 {done.created}件 / 更新 {done.updated}件 を取り込みました
          </p>
          {done.failures > 0 && (
            <p className="text-sm" style={{ color: '#B91C1C' }}>
              {done.failures}件は取り込みに失敗しました
            </p>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white"
            style={{ background: 'var(--primary)' }}
          >
            閉じる
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 取得期間 */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className={labelClass} style={labelStyle}>開始日（見積日・請求日）</label>
              <input
                type="date"
                value={range.from}
                onChange={e => { setRangeTouched(true); setRange(r => ({ ...r, from: e.target.value })) }}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>終了日</label>
              <input
                type="date"
                value={range.to}
                onChange={e => { setRangeTouched(true); setRange(r => ({ ...r, to: e.target.value })) }}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={loadPreview}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
              {loading ? '取得中...' : '取得'}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(254,226,226,0.6)' }}>
              <AlertCircle size={14} style={{ color: '#EF4444', marginTop: 2 }} />
              <div className="text-xs" style={{ color: '#B91C1C' }}>
                <p>{error}</p>
                {notConnected && (
                  <Link href="/settings" className="underline font-medium mt-1 inline-block">
                    設定画面でマネーフォワードと連携する
                  </Link>
                )}
              </div>
            </div>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-4 gap-2">
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(220,252,231,0.5)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>新規</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{preview.summary.create}件</p>
                </div>
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(219,234,254,0.5)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>更新</p>
                  <p className="text-sm font-bold" style={{ color: '#1D4ED8' }}>{preview.summary.update}件</p>
                </div>
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>変更なし</p>
                  <p className="text-sm font-bold">{preview.summary.unchanged}件</p>
                </div>
                <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>選択中の金額</p>
                  <p className="text-sm font-bold">{formatCurrency(selectedAmount)}</p>
                </div>
              </div>

              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                MFから見積書 {preview.quotes_fetched}件 / 請求書 {preview.billings_fetched}件 を取得しました。
                案件名とメモは取り込み後に編集しても、次回の同期で上書きされません。
              </p>

              {preview.rows.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
                  この期間に該当する帳票がありませんでした
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)', maxHeight: 360, overflowY: 'auto' }}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white z-10" style={{ borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th className="px-2 py-2 w-8">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            disabled={changeableRows.length === 0}
                          />
                        </th>
                        <th className="text-left px-2 py-2 font-medium" style={{ color: 'var(--muted)' }}>区分</th>
                        <th className="text-left px-2 py-2 font-medium" style={{ color: 'var(--muted)' }}>案件 / 顧客</th>
                        <th className="text-left px-2 py-2 font-medium" style={{ color: 'var(--muted)' }}>帳票</th>
                        <th className="text-left px-2 py-2 font-medium" style={{ color: 'var(--muted)' }}>ステータス</th>
                        <th className="text-right px-2 py-2 font-medium" style={{ color: 'var(--muted)' }}>金額(税抜)</th>
                        <th className="text-left px-2 py-2 font-medium" style={{ color: 'var(--muted)' }}>請求月</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map(row => {
                        const disabled = row.action === 'unchanged'
                        return (
                          <tr
                            key={row.key}
                            className={cn(!disabled && 'cursor-pointer hover:bg-gray-50')}
                            style={{ borderBottom: '1px solid var(--border)', opacity: disabled ? 0.55 : 1 }}
                            onClick={() => !disabled && toggle(row.key)}
                          >
                            <td className="px-2 py-2 align-top">
                              <input
                                type="checkbox"
                                checked={selected.has(row.key)}
                                disabled={disabled}
                                onChange={() => toggle(row.key)}
                                onClick={e => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium', ACTION_STYLE[row.action])}>
                                {ACTION_LABEL[row.action]}
                              </span>
                            </td>
                            <td className="px-2 py-2 align-top max-w-[220px]">
                              <p className="font-medium truncate">{row.name}</p>
                              <p className="truncate" style={{ color: 'var(--muted)' }}>{row.client_name}</p>
                              {row.matchedBy && row.action !== 'create' && (
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                                  既存案件「{row.targetProjectName}」に紐付け（{MATCHED_BY_LABEL[row.matchedBy]}）
                                </p>
                              )}
                              {row.changes.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {row.changes.map(c => (
                                    <li key={c.field} className="text-[10px]" style={{ color: '#1D4ED8' }}>
                                      {c.label}: {String(c.before ?? '—')} → {String(c.after ?? '—')}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-2 py-2 align-top whitespace-nowrap">
                              <span className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                                {row.quoteId && <FileText size={11} />}
                                {row.billingId && <FileCheck2 size={11} />}
                                <span className="text-[10px]">
                                  {[row.quoteNumber && `見積 ${row.quoteNumber}`, row.billingNumber && `請求 ${row.billingNumber}`]
                                    .filter(Boolean)
                                    .join(' / ') || (row.billingId ? '請求書' : '見積書')}
                                </span>
                              </span>
                            </td>
                            <td className="px-2 py-2 align-top"><StatusBadge status={row.status} /></td>
                            <td className="px-2 py-2 align-top text-right whitespace-nowrap">{formatCurrency(row.amount)}</td>
                            <td className="px-2 py-2 align-top whitespace-nowrap">{row.invoice_month ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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
              onClick={apply}
              disabled={applying || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              <Download size={14} />
              {applying ? '取り込み中...' : `${selected.size}件を取り込む`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
