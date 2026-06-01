'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { Trash2, ExternalLink, Search as SearchIcon } from 'lucide-react'
import type { SalesLead, LeadStatus, LeadPriority } from '@/lib/types'
import { getSalesLeads, updateSalesLead, deleteSalesLead } from '@/lib/supabase/queries'
import LeadSearchPanel from '@/components/leads/LeadSearchPanel'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SortableTh from '@/components/ui/SortableTh'
import { useSortable } from '@/lib/hooks/useSortable'

const tabs = ['営業リスト', '新規検索']

const STATUS_COLORS: Record<LeadStatus, { bg: string; color: string }> = {
  '未アプローチ': { bg: 'rgba(245,245,250,0.7)', color: 'var(--muted)' },
  'アプローチ中': { bg: 'rgba(254,243,199,0.7)', color: '#D97706' },
  '商談中': { bg: 'rgba(219,234,254,0.7)', color: '#2563EB' },
  '提案中': { bg: 'rgba(237,233,254,0.7)', color: '#7C3AED' },
  '受注': { bg: 'rgba(220,252,231,0.7)', color: '#16A34A' },
  '失注': { bg: 'rgba(254,226,226,0.7)', color: '#DC2626' },
  '保留': { bg: 'rgba(229,231,235,0.7)', color: '#4B5563' },
}

const PRIORITY_COLORS: Record<LeadPriority, string> = {
  '高': '#DC2626',
  '中': '#D97706',
  '低': '#6B7280',
}

const STATUSES: LeadStatus[] = ['未アプローチ','アプローチ中','商談中','提案中','受注','失注','保留']
const PRIORITIES: LeadPriority[] = ['高','中','低']

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState('営業リスト')
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SalesLead | undefined>()
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all')

  useEffect(() => {
    getSalesLeads()
      .then(setLeads)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const existingCorporateNumbers = useMemo(() => {
    const s = new Set<string>()
    leads.forEach(l => l.corporate_number && s.add(l.corporate_number))
    return s
  }, [leads])

  const filtered = useMemo(() =>
    statusFilter === 'all' ? leads : leads.filter(l => l.status === statusFilter),
    [leads, statusFilter])

  const sort = useSortable(filtered, {
    company_name: l => l.company_name,
    industry: l => l.industry ?? '',
    employees: l => l.employees ?? 0,
    revenue: l => l.revenue ?? 0,
    status: l => STATUSES.indexOf(l.status),
    priority: l => PRIORITIES.indexOf(l.priority),
    updated_at: l => l.updated_at,
  })

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: leads.length }
    STATUSES.forEach(s => { map[s] = leads.filter(l => l.status === s).length })
    return map
  }, [leads])

  const handleUpdate = async (id: string, patch: Partial<SalesLead>) => {
    try {
      const updated = await updateSalesLead(id, patch)
      setLeads(prev => prev.map(l => l.id === id ? updated : l))
    } catch (e) {
      alert(`更新に失敗しました: ${(e as Error).message}`)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteSalesLead(deleteTarget.id)
    setLeads(prev => prev.filter(l => l.id !== deleteTarget.id))
    setDeleteTarget(undefined)
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={!!deleteTarget}
        title="リードを削除"
        message={`「${deleteTarget?.company_name}」をリストから削除します。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(undefined)}
      />

      {/* タブ */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-all"
              style={activeTab === tab ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
              {tab === '新規検索' && <SearchIcon size={13} />}
              {tab}
              {tab === '営業リスト' && leads.length > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({leads.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* === 新規検索タブ === */}
      {activeTab === '新規検索' && (
        <LeadSearchPanel
          existingCorporateNumbers={existingCorporateNumbers}
          onSaved={lead => setLeads(prev => [lead, ...prev])}
        />
      )}

      {/* === 営業リストタブ === */}
      {activeTab === '営業リスト' && (
        <div className="space-y-3">
          {/* ステータスフィルター */}
          <div className="flex flex-wrap gap-1 p-1 rounded-lg w-fit"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <button onClick={() => setStatusFilter('all')}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md')}
              style={statusFilter === 'all' ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
              全て ({counts.all})
            </button>
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-md')}
                style={statusFilter === s
                  ? { background: STATUS_COLORS[s].color, color: 'white' }
                  : { color: STATUS_COLORS[s].color, background: STATUS_COLORS[s].bg }}>
                {s} ({counts[s] ?? 0})
              </button>
            ))}
          </div>

          {loading && <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</div>}

          {!loading && filtered.length === 0 && (
            <Card>
              <div className="text-center py-12 space-y-3">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {statusFilter === 'all' ? 'リードがまだ登録されていません' : `「${statusFilter}」のリードはありません`}
                </p>
                <button onClick={() => setActiveTab('新規検索')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg"
                  style={{ background: 'var(--primary)' }}>
                  <SearchIcon size={13} />新規検索へ
                </button>
              </div>
            </Card>
          )}

          {!loading && filtered.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                    <SortableTh label="会社名" sortKey="company_name" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="業種" sortKey="industry" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="従業員" sortKey="employees" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="売上高" sortKey="revenue" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="ステータス" sortKey="status" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="優先度" sortKey="priority" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="次回アクション" />
                    <SortableTh label="メモ" />
                    <SortableTh label="" />
                  </tr>
                </thead>
                <tbody>
                  {sort.sorted.map((l, i) => (
                    <tr key={l.id} style={{ borderBottom: i < sort.sorted.length - 1 ? '1px solid var(--border)' : 'none' }}
                      className="hover:bg-gray-50 group">
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <p className="font-medium truncate">{l.company_name}</p>
                        {l.url && (
                          <a href={l.url} target="_blank" rel="noreferrer"
                            className="text-xs flex items-center gap-0.5 truncate" style={{ color: 'var(--accent)' }}>
                            <ExternalLink size={10} />{l.url.replace(/^https?:\/\//, '').slice(0, 30)}
                          </a>
                        )}
                        {l.address && (
                          <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{l.address}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{l.industry ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-right" style={{ color: 'var(--muted)' }}>
                        {l.employees != null ? `${l.employees.toLocaleString()}名` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right" style={{ color: 'var(--muted)' }}>
                        {l.revenue != null ? `${Math.round(l.revenue / 10000).toLocaleString()}万円` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <select value={l.status}
                          onChange={e => handleUpdate(l.id, { status: e.target.value as LeadStatus })}
                          className="px-2 py-1 text-xs rounded-md border outline-none cursor-pointer"
                          style={{ background: STATUS_COLORS[l.status].bg, color: STATUS_COLORS[l.status].color, borderColor: 'var(--border)' }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <select value={l.priority}
                          onChange={e => handleUpdate(l.id, { priority: e.target.value as LeadPriority })}
                          className="px-2 py-1 text-xs rounded-md border outline-none cursor-pointer font-semibold"
                          style={{ color: PRIORITY_COLORS[l.priority], borderColor: 'var(--border)', background: 'var(--card)' }}>
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <input type="date" value={l.next_action_date ?? ''}
                          onChange={e => handleUpdate(l.id, { next_action_date: e.target.value || null })}
                          className="px-2 py-1 text-xs rounded-md border outline-none"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }} />
                      </td>
                      <td className="px-2 py-2.5">
                        <input value={l.notes ?? ''}
                          onChange={e => setLeads(prev => prev.map(p => p.id === l.id ? { ...p, notes: e.target.value } : p))}
                          onBlur={e => handleUpdate(l.id, { notes: e.target.value || null })}
                          placeholder="メモ"
                          className="w-32 px-2 py-1 text-xs rounded-md border outline-none"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }} />
                      </td>
                      <td className="px-2 py-2.5">
                        <button onClick={() => setDeleteTarget(l)}
                          className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                          style={{ color: '#EF4444' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
