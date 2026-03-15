'use client'

import { mockProjects, mockPaymentRecords } from '@/lib/mock-data'
import { PaymentRecord } from '@/lib/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import PaymentFormModal from '@/components/sales/PaymentFormModal'

const tabs = ['入金記録', '請求管理']

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState('入金記録')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [payments, setPayments] = useState(mockPaymentRecords)

  const handleSavePayment = (record: Omit<PaymentRecord, 'id' | 'created_at'>) => {
    const newRecord: PaymentRecord = {
      ...record,
      id: String(Date.now()),
      created_at: new Date().toISOString(),
    }
    setPayments(prev => [newRecord, ...prev])
  }

  const totalPayments = payments.reduce((s, r) => s + r.amount, 0)
  const unpaidProjects = mockProjects.filter(
    p => p.status === '請求済み' || (p.probability === '確定' && p.status === '進行中')
  )

  return (
    <div className="space-y-5">
      <PaymentFormModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSave={handleSavePayment}
      />
      {/* タブ */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-1.5 text-sm font-medium rounded-md transition-all')}
            style={activeTab === tab
              ? { background: 'var(--primary)', color: 'white' }
              : { color: 'var(--muted)' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === '入金記録' && (
        <div className="space-y-4">
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>入金総額</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(totalPayments)}
              </p>
            </Card>
            <Card>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>入金件数</p>
              <p className="text-2xl font-bold">{mockPaymentRecords.length}件</p>
            </Card>
          </div>

          {/* 入金記録テーブル */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">入金記録一覧</h3>
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: 'var(--primary)' }}
              >
                <Plus size={13} />
                入金登録
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                  {['プロジェクト名', '顧客名', '入金日', '入金額', '入金月'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((record, i) => (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-4 py-3 font-medium">{record.project_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        {record.client_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{record.payment_date}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent)' }}>
                      {formatCurrency(record.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{record.payment_month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {activeTab === '請求管理' && (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">請求予定・未入金案件</h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#D97706' }}>
                {unpaidProjects.length}件
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                  {['プロジェクト名', '顧客名', 'ステータス', '金額（税抜）', '請求月', '支払月'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unpaidProjects.map((project, i) => (
                  <tr
                    key={project.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: i < unpaidProjects.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-4 py-3 font-medium max-w-[200px]">
                      <span className="block truncate">{project.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        {project.client_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(project.amount)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{project.invoice_month ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{project.payment_month ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}
