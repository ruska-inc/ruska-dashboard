'use client'

import { useState, useEffect } from 'react'
import { Contractor, ContractorAssignment, InvoiceStatus } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { PaymentStatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Plus, Mail, Phone, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import AssignmentFormModal from '@/components/contractors/AssignmentFormModal'
import {
  getContractors,
  getContractorAssignments,
  createContractorAssignment,
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
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [assignments, setAssignments] = useState<(ContractorAssignment & { contractor: Contractor })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getContractors(), getContractorAssignments()])
      .then(([c, a]) => { setContractors(c); setAssignments(a) })
      .finally(() => setLoading(false))
  }, [])

  const handleSaveAssignment = async (data: Omit<ContractorAssignment, 'id' | 'created_at' | 'contractor'>) => {
    const created = await createContractorAssignment(data)
    const contractor = contractors.find(c => c.id === created.contractor_id)
    setAssignments(prev => [{ ...created, contractor: contractor! }, ...prev])
  }

  const totalPaid = assignments.filter(a => a.payment_status === '支払済').reduce((s, a) => s + a.amount_excl_tax, 0)
  const totalPending = assignments.filter(a => a.payment_status === '未対応').reduce((s, a) => s + a.amount_excl_tax, 0)

  return (
    <div className="space-y-5">
      <AssignmentFormModal
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        onSave={handleSaveAssignment}
      />

      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
            style={activeTab === tab ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
            {tab}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          <p className="text-sm">読み込み中...</p>
        </div>
      )}

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
              <p className="text-2xl font-bold">{assignments.length}件</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">委託案件一覧</h3>
              <button onClick={() => setAssignmentModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: 'var(--primary)' }}>
                <Plus size={13} />案件追加
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                  {['案件名', '委託先', '費用（税抜）', '費用（税込）', '請求月', '支払月', '振込状況', '備考'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment, i) => (
                  <tr key={assignment.id} className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: i < assignments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3 font-medium max-w-[180px]"><span className="block truncate">{assignment.project_name}</span></td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs font-medium">{assignment.contractor?.company_name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{assignment.contractor?.contact_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(assignment.amount_excl_tax)}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{formatCurrency(assignment.amount_incl_tax)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{assignment.invoice_month ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{assignment.payment_month ?? '—'}</td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={assignment.payment_status} /></td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{assignment.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {!loading && activeTab === '委託先マスタ' && (
        <div className="grid grid-cols-2 gap-4">
          {contractors.map(contractor => (
            <Card key={contractor.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{contractor.company_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{contractor.contact_name}</p>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-md font-medium', invoiceStatusColors[contractor.invoice_status])}>
                  {contractor.invoice_status}
                </span>
              </div>

              {contractor.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contractor.skills.map(skill => (
                    <span key={skill} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                      <Tag size={10} />{skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                {contractor.email && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <Mail size={12} />{contractor.email}
                  </div>
                )}
                {contractor.phone && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <Phone size={12} />{contractor.phone}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>委託案件数</p>
                <p className="text-lg font-bold">
                  {assignments.filter(a => a.contractor_id === contractor.id).length}件
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
