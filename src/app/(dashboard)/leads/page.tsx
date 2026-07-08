'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { Trash2, ExternalLink, Search as SearchIcon, Mail, FileText, History, Plus, Pencil } from 'lucide-react'
import type { SalesLead, LeadStatus, LeadPriority, EmailTemplate, SentEmail } from '@/lib/types'
import {
  getSalesLeads, updateSalesLead, deleteSalesLead,
  getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  getSentEmails,
} from '@/lib/supabase/queries'
import LeadSearchPanel from '@/components/leads/LeadSearchPanel'
import EmailComposeModal from '@/components/leads/EmailComposeModal'
import TemplateFormModal from '@/components/leads/TemplateFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SortableTh from '@/components/ui/SortableTh'
import { useSortable } from '@/lib/hooks/useSortable'

const tabs = ['営業リスト', '新規検索', '送信履歴', 'テンプレート'] as const
type TabKey = typeof tabs[number]

const STATUS_COLORS: Record<LeadStatus, { bg: string; color: string }> = {
  '未アプローチ': { bg: 'rgba(245,245,250,0.7)', color: 'var(--muted)' },
  'アプローチ中': { bg: 'rgba(254,243,199,0.7)', color: '#D97706' },
  '商談中': { bg: 'rgba(219,234,254,0.7)', color: '#2563EB' },
  '提案中': { bg: 'rgba(237,233,254,0.7)', color: '#7C3AED' },
  '受注': { bg: 'rgba(220,252,231,0.7)', color: '#16A34A' },
  '失注': { bg: 'rgba(254,226,226,0.7)', color: '#DC2626' },
  '保留': { bg: 'rgba(229,231,235,0.7)', color: '#4B5563' },
}
const PRIORITY_COLORS: Record<LeadPriority, string> = { '高': '#DC2626', '中': '#D97706', '低': '#6B7280' }
const STATUSES: LeadStatus[] = ['未アプローチ','アプローチ中','商談中','提案中','受注','失注','保留']
const PRIORITIES: LeadPriority[] = ['高','中','低']

const inputClass = 'w-full px-2 py-1 text-xs rounded-md border outline-none'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('営業リスト')
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SalesLead | undefined>()
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all')

  // 選択・メール送信・テンプレート
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [composeLeads, setComposeLeads] = useState<SalesLead[]>([])
  const [templateModal, setTemplateModal] = useState<{ open: boolean; initial?: EmailTemplate }>({ open: false })
  const [deleteTemplate, setDeleteTemplate] = useState<EmailTemplate | undefined>()

  useEffect(() => {
    Promise.all([getSalesLeads(), getEmailTemplates()])
      .then(([l, t]) => { setLeads(l); setTemplates(t) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeTab === '送信履歴') {
      getSentEmails().then(setSentEmails).catch(() => {})
    }
  }, [activeTab])

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
    email: l => l.email ?? '',
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

  // === 選択 ===
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === sort.sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sort.sorted.map(l => l.id)))
    }
  }
  const selectedLeads = useMemo(() => leads.filter(l => selectedIds.has(l.id)), [leads, selectedIds])

  // === テンプレート CRUD ===
  const handleSaveTemplate = async (input: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (templateModal.initial) {
        const updated = await updateEmailTemplate(templateModal.initial.id, input)
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
      } else {
        const created = await createEmailTemplate(input)
        setTemplates(prev => [...prev, created].sort((a, b) => a.sort_order - b.sort_order))
      }
    } catch (e) {
      alert(`保存に失敗しました: ${(e as Error).message}\n\nemail_templatesテーブルが作成されているか確認してください(supabase/email_features.sql)`)
    }
  }
  const handleDeleteTemplate = async () => {
    if (!deleteTemplate) return
    await deleteEmailTemplate(deleteTemplate.id)
    setTemplates(prev => prev.filter(t => t.id !== deleteTemplate.id))
    setDeleteTemplate(undefined)
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
      <ConfirmDialog
        open={!!deleteTemplate}
        title="テンプレートを削除"
        message={`「${deleteTemplate?.name}」を削除します。`}
        onConfirm={handleDeleteTemplate}
        onCancel={() => setDeleteTemplate(undefined)}
      />
      <TemplateFormModal
        open={templateModal.open}
        onClose={() => setTemplateModal({ open: false })}
        onSave={handleSaveTemplate}
        initial={templateModal.initial}
      />
      <EmailComposeModal
        open={composeLeads.length > 0}
        onClose={() => setComposeLeads([])}
        leads={composeLeads}
        templates={templates}
        onSent={() => {
          setSelectedIds(new Set())
          if (activeTab === '送信履歴') {
            getSentEmails().then(setSentEmails).catch(() => {})
          }
        }}
      />

      {/* タブ */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-all"
              style={activeTab === tab ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
              {tab === '新規検索' && <SearchIcon size={13} />}
              {tab === '送信履歴' && <History size={13} />}
              {tab === 'テンプレート' && <FileText size={13} />}
              {tab}
              {tab === '営業リスト' && leads.length > 0 && <span className="ml-1 text-[10px] opacity-70">({leads.length})</span>}
              {tab === 'テンプレート' && templates.length > 0 && <span className="ml-1 text-[10px] opacity-70">({templates.length})</span>}
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 p-1 rounded-lg"
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
            {selectedIds.size > 0 && (
              <button onClick={() => setComposeLeads(selectedLeads)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md"
                style={{ background: 'var(--primary)' }}>
                <Mail size={13} />{selectedIds.size}件に一括送信
              </button>
            )}
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
                    <th className="w-8 px-3">
                      <input type="checkbox"
                        checked={sort.sorted.length > 0 && selectedIds.size === sort.sorted.length}
                        onChange={toggleSelectAll} />
                    </th>
                    <SortableTh label="会社名" sortKey="company_name" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="メール" sortKey="email" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="担当者" />
                    <SortableTh label="業種" sortKey="industry" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="ステータス" sortKey="status" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="優先度" sortKey="priority" currentKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                    <SortableTh label="次回アクション" />
                    <SortableTh label="" />
                  </tr>
                </thead>
                <tbody>
                  {sort.sorted.map((l, i) => (
                    <tr key={l.id} style={{ borderBottom: i < sort.sorted.length - 1 ? '1px solid var(--border)' : 'none' }}
                      className="hover:bg-gray-50 group">
                      <td className="w-8 px-3">
                        <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} />
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        <p className="font-medium truncate">{l.company_name}</p>
                        {l.url && (
                          <a href={l.url} target="_blank" rel="noreferrer"
                            className="text-xs flex items-center gap-0.5 truncate" style={{ color: 'var(--accent)' }}>
                            <ExternalLink size={10} />{l.url.replace(/^https?:\/\//, '').slice(0, 30)}
                          </a>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <input type="email" value={l.email ?? ''}
                          onChange={e => setLeads(prev => prev.map(p => p.id === l.id ? { ...p, email: e.target.value } : p))}
                          onBlur={e => handleUpdate(l.id, { email: e.target.value || null })}
                          placeholder="email@example.com"
                          className={cn(inputClass, 'w-40')} style={inputStyle} />
                      </td>
                      <td className="px-2 py-2.5">
                        <input value={l.contact_person_name ?? ''}
                          onChange={e => setLeads(prev => prev.map(p => p.id === l.id ? { ...p, contact_person_name: e.target.value } : p))}
                          onBlur={e => handleUpdate(l.id, { contact_person_name: e.target.value || null })}
                          placeholder="担当者名"
                          className={cn(inputClass, 'w-28')} style={inputStyle} />
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{l.industry ?? '—'}</td>
                      <td className="px-2 py-2.5">
                        <select value={l.status} onChange={e => handleUpdate(l.id, { status: e.target.value as LeadStatus })}
                          className={cn(inputClass, 'cursor-pointer')}
                          style={{ background: STATUS_COLORS[l.status].bg, color: STATUS_COLORS[l.status].color, borderColor: 'var(--border)' }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <select value={l.priority} onChange={e => handleUpdate(l.id, { priority: e.target.value as LeadPriority })}
                          className={cn(inputClass, 'cursor-pointer font-semibold')}
                          style={{ color: PRIORITY_COLORS[l.priority], borderColor: 'var(--border)', background: 'var(--card)' }}>
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <input type="date" value={l.next_action_date ?? ''}
                          onChange={e => handleUpdate(l.id, { next_action_date: e.target.value || null })}
                          className={inputClass} style={inputStyle} />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setComposeLeads([l])}
                            disabled={!l.email}
                            title={l.email ? 'メール送信' : 'メールアドレス未登録'}
                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                            style={{ color: 'var(--primary)' }}>
                            <Mail size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(l)}
                            className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50"
                            style={{ color: '#EF4444' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* === 送信履歴タブ === */}
      {activeTab === '送信履歴' && (
        <Card className="p-0 overflow-hidden">
          {sentEmails.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
              送信履歴がまだありません
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                  {['送信日時','宛先','件名','ステータス'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sentEmails.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < sentEmails.length - 1 ? '1px solid var(--border)' : 'none' }}
                    className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(s.sent_at).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium">{s.lead?.company_name ?? '—'}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.to_email}</p>
                    </td>
                    <td className="px-4 py-2.5 max-w-[300px]">
                      <p className="text-xs truncate">{s.subject}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs"
                        style={s.status === 'sent'
                          ? { background: 'rgba(220,252,231,0.7)', color: '#16A34A' }
                          : { background: 'rgba(254,226,226,0.7)', color: '#DC2626' }}>
                        {s.status === 'sent' ? '送信済' : s.status === 'failed' ? '失敗' : s.status}
                      </span>
                      {s.error_message && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#DC2626' }}>{s.error_message}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* === テンプレート管理タブ === */}
      {activeTab === 'テンプレート' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setTemplateModal({ open: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ background: 'var(--primary)' }}>
              <Plus size={13} />テンプレート追加
            </button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
                テンプレートがまだ登録されていません
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <Card key={t.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{t.name}</p>
                        {t.is_default && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                            デフォルト
                          </span>
                        )}
                      </div>
                      <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>件名: {t.subject}</p>
                      <pre className="text-xs whitespace-pre-wrap max-h-32 overflow-hidden"
                        style={{ color: 'var(--foreground)' }}>{t.body}</pre>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setTemplateModal({ open: true, initial: t })}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100"
                        style={{ color: 'var(--muted)' }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTemplate(t)}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"
                        style={{ color: '#EF4444' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
