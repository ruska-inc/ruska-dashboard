'use client'

import { useState, useMemo, useEffect } from 'react'
import { Project, ProjectStatus } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { StatusBadge, ProbabilityBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProjectFormModal from '@/components/projects/ProjectFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ExcelImportModal from '@/components/import/ExcelImportModal'
import MFSyncModal from '@/components/moneyforward/MFSyncModal'
import { getProjects, createProject, updateProject, deleteProject } from '@/lib/supabase/queries'
import { Trash2, Upload, RefreshCw } from 'lucide-react'
import { usePeriods } from '@/lib/hooks/usePeriods'
import { useSortable, monthSortValue } from '@/lib/hooks/useSortable'
import SortableTh from '@/components/ui/SortableTh'

const STATUS_ORDER: ProjectStatus[] = [
  '見積もり中', '進行中', '外注', '請求済み', '着金済み', '立て替え', '完了済', '失注'
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('全期')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Project | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)
  const [mfSyncOpen, setMfSyncOpen] = useState(false)
  const { periods: periodSettings } = usePeriods()
  const periods = [...periodSettings.map(p => p.name), '全期']

  useEffect(() => {
    if (periodSettings.length > 0) setSelectedPeriod(periodSettings[0].name)
  }, [periodSettings])

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (data: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    if (editTarget) {
      const updated = await updateProject(editTarget.id, data)
      setProjects(prev => prev.map(p => p.id === editTarget.id ? updated : p))
    } else {
      const created = await createProject(data)
      setProjects(prev => [created, ...prev])
    }
    setEditTarget(undefined)
  }

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = p.name.includes(search) || p.client_name.includes(search)
      const matchPeriod = selectedPeriod === '全期' || p.period === selectedPeriod
      return matchSearch && matchPeriod
    })
  }, [projects, search, selectedPeriod])

  const PROBABILITY_ORDER: Record<string, number> = {
    '確定': 0, '確度（高）': 1, '確度（中）': 2, '確度（低）': 3, '保留・トラブル有り': 4, '失注': 5,
  }
  const { sorted: sortedProjects, sortKey, sortDir, toggle: toggleSort } = useSortable(
    filtered,
    {
      name: p => p.name,
      client_name: p => p.client_name,
      status: p => STATUS_ORDER.indexOf(p.status),
      probability: p => PROBABILITY_ORDER[p.probability] ?? 99,
      amount: p => p.amount,
      tax_amount: p => p.tax_amount,
      period: p => p.period,
      invoice_month: p => monthSortValue(p.invoice_month),
      payment_month: p => monthSortValue(p.payment_month),
    },
  )

  const grouped = useMemo(() => {
    const groups: Record<string, Project[]> = {}
    STATUS_ORDER.forEach(status => {
      const items = sortedProjects.filter(p => p.status === status)
      if (items.length > 0) groups[status] = items
    })
    return groups
  }, [sortedProjects])

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProject(deleteTarget.id)
    setProjects(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(undefined)
  }

  const openNew = () => { setEditTarget(undefined); setModalOpen(true) }
  const openEdit = (p: Project) => { setEditTarget(p); setModalOpen(true) }

  return (
    <div className="space-y-4">
      <ProjectFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined) }}
        onSave={handleSave}
        initial={editTarget}
      />
      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={imported => setProjects(prev => [...imported, ...prev])}
      />
      <MFSyncModal
        open={mfSyncOpen}
        onClose={() => setMfSyncOpen(false)}
        onImported={({ created, updated }) => {
          const updatedById = new Map(updated.map(p => [p.id, p]))
          setProjects(prev => [
            ...created,
            ...prev.map(p => updatedById.get(p.id) ?? p),
          ])
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="プロジェクトを削除"
        message={`「${deleteTarget?.name}」を削除します。この操作は取り消せません。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(undefined)}
      />

      {/* ツールバー */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="プロジェクト名・顧客名で検索"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
              style={selectedPeriod === p ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          onClick={() => setMfSyncOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 border"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <RefreshCw size={15} />
          MFから取り込み
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 border"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <Upload size={15} />
          Excelインポート
        </button>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={15} />
          新規追加
        </button>
      </div>

      {/* 合計サマリー */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '件数（確定）', value: `${filtered.filter(p => p.probability === '確定').length}件` },
          { label: '合計金額（税抜・確定）', value: formatCurrency(filtered.filter(p => p.probability === '確定').reduce((s, p) => s + p.amount, 0)) },
          { label: '合計税額（確定）', value: formatCurrency(filtered.filter(p => p.probability === '確定').reduce((s, p) => s + p.tax_amount, 0)) },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between px-4 py-3 rounded-lg border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{item.label}</span>
            <span className="text-sm font-semibold">{item.value}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          <p className="text-sm">読み込み中...</p>
        </div>
      )}

      {/* グループ別テーブル */}
      {!loading && Object.entries(grouped).map(([status, items]) => {
        const isCollapsed = collapsedGroups.has(status)
        const groupTotal = items.reduce((s, p) => s + p.amount, 0)

        return (
          <Card key={status} className="p-0 overflow-hidden">
            <button
              onClick={() => toggleGroup(status)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              style={{ borderBottom: isCollapsed ? 'none' : '1px solid var(--border)' }}
            >
              {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              <StatusBadge status={status as ProjectStatus} />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{items.length}件</span>
              <span className="ml-auto text-xs font-medium" style={{ color: 'var(--muted)' }}>
                合計 {formatCurrency(groupTotal)}
              </span>
            </button>

            {!isCollapsed && (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                    <SortableTh label="プロジェクト名" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="顧客名" sortKey="client_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="ステータス" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="確度" sortKey="probability" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="金額（税抜）" sortKey="amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="税額" sortKey="tax_amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="期" sortKey="period" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="請求月" sortKey="invoice_month" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="入金月" sortKey="payment_month" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableTh label="" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((project, i) => (
                    <tr
                      key={project.id}
                      onClick={() => openEdit(project)}
                      className="cursor-pointer transition-colors hover:bg-gray-50 group"
                      style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <td className="px-4 py-3 font-medium max-w-[240px]">
                        <span className="block truncate">{project.name}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs truncate max-w-full"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          {project.client_name}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                      <td className="px-4 py-3"><ProbabilityBadge probability={project.probability} /></td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(project.amount)}</td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>{formatCurrency(project.tax_amount)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{project.period}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{project.invoice_month ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{project.payment_month ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(project) }}
                          className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )
      })}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          <p className="text-sm">該当するプロジェクトがありません</p>
        </div>
      )}
    </div>
  )
}
