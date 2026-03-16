'use client'

import { useState, useEffect, useMemo } from 'react'
import { Contractor, ContractorAssignment, InvoiceStatus } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { PaymentStatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Plus, Mail, Phone, Tag, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import AssignmentFormModal from '@/components/contractors/AssignmentFormModal'
import ContractorFormModal from '@/components/contractors/ContractorFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { usePeriods } from '@/lib/hooks/usePeriods'
import {
  getContractors, getContractorAssignments,
  createContractorAssignment, updateContractorAssignment, deleteContractorAssignment,
  createContractor, updateContractor, deleteContractor,
} from '@/lib/supabase/queries'

const tabs = ['委託案件', '委託先マスタ']

const invoiceStatusColors: Record<InvoiceStatus, string> = {
  '登録済み': 'bg-green-50 text-green-700',
  '免税事業者': 'bg-yellow-50 text-yellow-700',
  '申請中': 'bg-blue-50 text-blue-700',
  '未定': 'bg-gray-50 text-gray-500',
}

export default function ContractorsPage() {
  const [activeTab, setActiveTab] = useState('委託案件')
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [assignments, setAssignments] = useState<(ContractorAssignment & { contractor: Contractor })[]>([])
  const [loading, setLoading] = useState(true)

  // 案件モーダル
  const [assignmentModal, setAssignmentModal] = useState(false)
  const [editAssignment, setEditAssignment] = useState<ContractorAssignment | undefined>()

  // 委託先モーダル
  const [contractorModal, setContractorModal] = useState(false)
  const [editContractor, setEditContractor] = useState<Contractor | undefined>()

  // 削除確認
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] = useState<ContractorAssignment | undefined>()
  const [deleteContractorTarget, setDeleteContractorTarget] = useState<Contractor | undefined>()

  const [selectedPeriod, setSelectedPeriod] = useState('全期')
  const { periods } = usePeriods()

  useEffect(() => {
    if (periods.length > 0) setSelectedPeriod(periods[0].name)
  }, [periods])

  useEffect(() => {
    Promise.all([getContractors(), getContractorAssignments()])
      .then(([c, a]) => { setContractors(c); setAssignments(a) })
      .finally(() => setLoading(false))
  }, [])

  // 案件 CRUD
  const handleSaveAssignment = async (data: Omit<ContractorAssignment, 'id' | 'created_at' | 'contractor'>) => {
    if (editAssignment) {
      const updated = await updateContractorAssignment(editAssignment.id, data)
      const contractor = contractors.find(c => c.id === updated.contractor_id)
      setAssignments(prev => prev.map(a => a.id === editAssignment.id ? { ...updated, contractor: contractor! } : a))
    } else {
      const created = await createContractorAssignment(data)
      const contractor = contractors.find(c => c.id === created.contractor_id)
      setAssignments(prev => [{ ...created, contractor: contractor! }, ...prev])
    }
    setEditAssignment(undefined)
  }

  const handleDeleteAssignment = async () => {
    if (!deleteAssignmentTarget) return
    await deleteContractorAssignment(deleteAssignmentTarget.id)
    setAssignments(prev => prev.filter(a => a.id !== deleteAssignmentTarget.id))
    setDeleteAssignmentTarget(undefined)
  }

  // 委託先 CRUD
  const handleSaveContractor = async (data: Omit<Contractor, 'id' | 'created_at'>) => {
    if (editContractor) {
      const updated = await updateContractor(editContractor.id, data)
      setContractors(prev => prev.map(c => c.id === editContractor.id ? updated : c))
    } else {
      const created = await createContractor(data)
      setContractors(prev => [created, ...prev])
    }
    setEditContractor(undefined)
  }

  const handleDeleteContractor = async () => {
    if (!deleteContractorTarget) return
    await deleteContractor(deleteContractorTarget.id)
    setContractors(prev => prev.filter(c => c.id !== deleteContractorTarget.id))
    setDeleteContractorTarget(undefined)
  }

  const filteredAssignments = useMemo(() =>
    selectedPeriod === '全期' ? assignments : assignments.filter(a => a.period === selectedPeriod),
    [assignments, selectedPeriod])

  const totalPaid = filteredAssignments.filter(a => a.payment_status === '支払済').reduce((s, a) => s + a.amount_excl_tax, 0)
  const totalPending = filteredAssignments.filter(a => a.payment_status === '未対応').reduce((s, a) => s + a.amount_excl_tax, 0)

  return (
    <div className="space-y-5">
      {/* モーダル類 */}
      <AssignmentFormModal
        open={assignmentModal}
        onClose={() => { setAssignmentModal(false); setEditAssignment(undefined) }}
        onSave={handleSaveAssignment}
        contractors={contractors}
        initial={editAssignment}
      />
      <ContractorFormModal
        open={contractorModal}
        onClose={() => { setContractorModal(false); setEditContractor(undefined) }}
        onSave={handleSaveContractor}
        initial={editContractor}
      />
      <ConfirmDialog
        open={!!deleteAssignmentTarget}
        title="委託案件を削除"
        message={`「${deleteAssignmentTarget?.project_name}」を削除します。`}
        onConfirm={handleDeleteAssignment}
        onCancel={() => setDeleteAssignmentTarget(undefined)}
      />
      <ConfirmDialog
        open={!!deleteContractorTarget}
        title="委託先を削除"
        message={`「${deleteContractorTarget?.company_name}」を削除します。関連する案件も削除されます。`}
        onConfirm={handleDeleteContractor}
        onCancel={() => setDeleteContractorTarget(undefined)}
      />

      {/* タブ・期フィルター */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
              style={activeTab === tab ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === '委託案件' && (
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {[...periods.map(p => p.name), '全期'].map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
                style={selectedPeriod === p ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="text-center py-16"><p className="text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</p></div>}

      {/* 委託案件タブ */}
      {!loading && activeTab === '委託案件' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>支払済合計</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(totalPaid)}</p>
            </Card>
            <Card>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>未対応合計</p>
              <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>{formatCurrency(totalPending)}</p>
            </Card>
            <Card>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>委託件数</p>
              <p className="text-2xl font-bold">{filteredAssignments.length}件</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">委託案件一覧</h3>
              <button onClick={() => { setEditAssignment(undefined); setAssignmentModal(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: 'var(--primary)' }}>
                <Plus size={13} />案件追加
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                  {['案件名', '委託先', '費用（税抜）', '費用（税込）', '請求月', '支払月', '振込状況', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((a, i) => (
                  <tr key={a.id}
                    onClick={() => { setEditAssignment(a); setAssignmentModal(true) }}
                    className="cursor-pointer hover:bg-gray-50 transition-colors group"
                    style={{ borderBottom: i < filteredAssignments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3 font-medium max-w-[160px]"><span className="block truncate">{a.project_name}</span></td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium">{a.contractor?.company_name}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{a.contractor?.contact_name}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(a.amount_excl_tax)}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{formatCurrency(a.amount_incl_tax)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{a.invoice_month ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{a.payment_month ?? '—'}</td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={a.payment_status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); setEditAssignment(a); setAssignmentModal(true) }}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100"
                          style={{ color: 'var(--muted)' }}><Pencil size={12} /></button>
                        <button onClick={e => { e.stopPropagation(); setDeleteAssignmentTarget(a) }}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"
                          style={{ color: '#EF4444' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* 委託先マスタタブ */}
      {!loading && activeTab === '委託先マスタ' && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold">委託先マスタ</h3>
            <button onClick={() => { setEditContractor(undefined); setContractorModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: 'var(--primary)' }}>
              <Plus size={13} />委託先追加
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                {['会社名', '担当者', 'スキル', 'メール', '電話', '適格番号', '案件数', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contractors.map((contractor, i) => (
                <tr key={contractor.id}
                  onClick={() => { setEditContractor(contractor); setContractorModal(true) }}
                  className="cursor-pointer hover:bg-gray-50 transition-colors group"
                  style={{ borderBottom: i < contractors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-4 py-3 font-medium">{contractor.company_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{contractor.contact_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contractor.skills.map(skill => (
                        <span key={skill} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          <Tag size={10} />{skill}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                    {contractor.email && <span className="flex items-center gap-1"><Mail size={11} />{contractor.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                    {contractor.phone && <span className="flex items-center gap-1"><Phone size={11} />{contractor.phone}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-md font-medium', invoiceStatusColors[contractor.invoice_status])}>
                      {contractor.invoice_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">
                    {assignments.filter(a => a.contractor_id === contractor.id).length}件
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setEditContractor(contractor); setContractorModal(true) }}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100"
                        style={{ color: 'var(--muted)' }}><Pencil size={12} /></button>
                      <button onClick={e => { e.stopPropagation(); setDeleteContractorTarget(contractor) }}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"
                        style={{ color: '#EF4444' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
