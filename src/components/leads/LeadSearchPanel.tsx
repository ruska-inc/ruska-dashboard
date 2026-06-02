'use client'

import { useState } from 'react'
import { Search, Loader2, AlertCircle, Plus, Check } from 'lucide-react'
import type { SalesNowCompany, SalesLead, LeadStatus, LeadPriority } from '@/lib/types'
import { createSalesLead } from '@/lib/supabase/queries'
import { formatCurrency } from '@/lib/utils'

interface Props {
  existingCorporateNumbers: Set<string>
  onSaved: (lead: SalesLead) => void
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]

export default function LeadSearchPanel({ existingCorporateNumbers, onSaved }: Props) {
  const [keyword, setKeyword] = useState('')
  const [prefectures, setPrefectures] = useState<string[]>([])
  const [employeesOver, setEmployeesOver] = useState('')
  const [employeesUnder, setEmployeesUnder] = useState('')
  const [revenueOver, setRevenueOver] = useState('')
  const [revenueUnder, setRevenueUnder] = useState('')
  const [perPage, setPerPage] = useState(10)

  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SalesNowCompany[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())

  const handleSearch = async () => {
    setSearching(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { page: 1, perPage }
      // keywordは配列 (スペース or カンマ区切りで分割)
      if (keyword.trim()) {
        body.keyword = keyword.trim().split(/[\s,、]+/).filter(Boolean)
      }
      if (prefectures.length > 0) body.prefectures = prefectures
      if (employeesOver) body.employeesOver = Number(employeesOver)
      if (employeesUnder) body.employeesUnder = Number(employeesUnder)
      if (revenueOver) body.revenueOver = Number(revenueOver) * 10000  // 万円→円
      if (revenueUnder) body.revenueUnder = Number(revenueUnder) * 10000

      const res = await fetch('/api/salesnow/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || data.message || `エラー (${res.status})`)
        setResults([])
        return
      }
      // SalesNow APIのレスポンス構造に合わせて柔軟に
      const companies: SalesNowCompany[] = data.companies ?? data.results ?? data.items ?? []
      const total = data.totalCount ?? data.total ?? null
      setResults(companies)
      setTotalCount(total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async (c: SalesNowCompany) => {
    const corporateNumber = c.corporateNumber ?? null
    if (corporateNumber && existingCorporateNumbers.has(corporateNumber)) return
    if (corporateNumber && savedSet.has(corporateNumber)) return
    try {
      const created = await createSalesLead({
        corporate_number: corporateNumber,
        company_name: c.companyName,
        url: c.companyUrl ?? null,
        address: c.address ?? null,
        phone: c.phoneNumber ?? null,
        industry: c.industryMedium ?? c.industryLarge ?? null,
        representative: c.representativeName ?? null,
        employees: c.employeeCount ?? null,
        capital: c.capital ?? null,
        revenue: c.revenue ?? null,
        established_year: c.establishedYearMonth
          ? parseInt(String(c.establishedYearMonth).slice(0, 4), 10) || null
          : null,
        salesnow_score: c.salesnowScore ?? null,
        status: '未アプローチ' as LeadStatus,
        priority: '中' as LeadPriority,
        assigned_to: null,
        notes: null,
        next_action_date: null,
      })
      onSaved(created)
      if (corporateNumber) {
        setSavedSet(prev => new Set(prev).add(corporateNumber))
      }
    } catch (e) {
      alert(`保存に失敗しました: ${(e as Error).message}\n\nsales_leadsテーブルが作成されているか確認してください(supabase/sales_leads.sql)`)
    }
  }

  const togglePrefecture = (p: string) => {
    setPrefectures(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  return (
    <div className="space-y-4">
      {/* 検索フォーム */}
      <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div>
          <label className={labelClass} style={labelStyle}>
            キーワード(業界・事業説明、複数指定はスペースまたはカンマ区切り、AND結合)
          </label>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="例: SaaS クラウド  /  WEB制作,ECサイト"
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            都道府県 {prefectures.length > 0 && <span style={{ color: 'var(--accent)' }}>({prefectures.length}件選択中)</span>}
          </label>
          <div className="flex flex-wrap gap-1 max-h-28 overflow-auto p-2 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            {PREFECTURES.map(p => (
              <button
                type="button"
                key={p}
                onClick={() => togglePrefecture(p)}
                className="px-2 py-1 text-xs rounded-md transition-colors"
                style={prefectures.includes(p)
                  ? { background: 'var(--primary)', color: 'white' }
                  : { background: 'rgba(255,255,255,0.5)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>従業員数 (以上)</label>
            <input type="number" value={employeesOver} onChange={e => setEmployeesOver(e.target.value)}
              className={inputClass} style={inputStyle} placeholder="例: 10" />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>従業員数 (以下)</label>
            <input type="number" value={employeesUnder} onChange={e => setEmployeesUnder(e.target.value)}
              className={inputClass} style={inputStyle} placeholder="例: 100" />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>売上高 万円 (以上)</label>
            <input type="number" value={revenueOver} onChange={e => setRevenueOver(e.target.value)}
              className={inputClass} style={inputStyle} placeholder="例: 10000" />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>売上高 万円 (以下)</label>
            <input type="number" value={revenueUnder} onChange={e => setRevenueUnder(e.target.value)}
              className={inputClass} style={inputStyle} placeholder="例: 500000" />
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={labelClass} style={labelStyle}>取得件数 (1〜50, クレジット消費に注意)</label>
            <input type="number" min={1} max={50} value={perPage}
              onChange={e => setPerPage(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className={inputClass} style={inputStyle} />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            検索
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(254,226,226,0.6)' }}>
          <AlertCircle size={14} style={{ color: '#EF4444', marginTop: 2 }} />
          <p className="text-xs whitespace-pre-wrap" style={{ color: '#B91C1C' }}>{error}</p>
        </div>
      )}

      {/* 結果 */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
            <span>{results.length}件表示{totalCount !== null && ` (ヒット総数: ${totalCount.toLocaleString()}件)`}</span>
            <span>クレジット消費: {results.length}</span>
          </div>
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                  {['会社名', '業種', '所在地', '従業員', '売上高', '電話', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((c, i) => {
                  const cn = c.corporateNumber ?? ''
                  const alreadySaved = (cn && existingCorporateNumbers.has(cn)) || savedSet.has(cn)
                  return (
                    <tr key={cn || i} style={{ borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}
                      className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-medium max-w-[200px]">
                        <span className="block truncate">{c.companyName}</span>
                        {c.companyUrl && (
                          <a href={String(c.companyUrl)} target="_blank" rel="noreferrer"
                            className="text-xs underline truncate block" style={{ color: 'var(--accent)' }}>
                            {String(c.companyUrl)}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                        {c.industryMedium ?? c.industryLarge ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[180px]" style={{ color: 'var(--muted)' }}>
                        <span className="block truncate">{c.address ?? '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--muted)' }}>
                        {c.employeeCount != null ? `${c.employeeCount.toLocaleString()}名` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--muted)' }}>
                        {c.revenue != null ? formatCurrency(c.revenue) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{c.phoneNumber ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => handleSave(c)}
                          disabled={alreadySaved}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium disabled:opacity-60"
                          style={alreadySaved
                            ? { background: 'rgba(220,252,231,0.7)', color: '#16A34A' }
                            : { background: 'var(--primary)', color: 'white' }}
                        >
                          {alreadySaved ? <><Check size={12} />保存済</> : <><Plus size={12} />保存</>}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
