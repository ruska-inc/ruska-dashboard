'use client'

import { useState, useEffect } from 'react'
import { Project, PaymentRecord } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import PaymentFormModal from '@/components/sales/PaymentFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getProjects, getPaymentRecords, createPaymentRecord, updatePaymentRecord, deletePaymentRecord } from '@/lib/supabase/queries'
import { Trash2 } from 'lucide-react'

const tabs = ['入金記録', '請求管理']

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState('入金記録')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | undefined>(undefined)
  const [editTarget, setEditTarget] = useState<PaymentRecord | undefined>(undefined)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    Promise.all([getPaymentRecords(), getProjects()])
      .then(([p, pr]) => { setPayments(p); setProjects(pr) })
      .finally(() => setLoading(false))
  }, [])

  const handleSavePayment = async (record: Omit<PaymentRecord, 'id' | 'created_at'>) => {
    if (editTarget) {
      const updated = await updatePaymentRecord(editTarget.id, record)
      setPayments(prev => prev.map(p => p.id === editTarget.id ? updated : p))
      setEditTarget(undefined)
    } else {
      const created = await createPaymentRecord(record)
      setPayments(prev => [created, ...prev])
    }
  }

  const handleDeletePayment = async () => {
    if (!deleteTarget) return
    await deletePaymentRecord(deleteTarget.id)
    setPayments(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(undefined)
  }

  const handleMfSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/moneyforward/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSyncMsg(`エラー: ${data.error}`)
      } else {
        setSyncMsg(`✓ ${data.inserted}件の入金データを同期しました`)
        if (data.inserted > 0) {
          const updated = await import('@/lib/supabase/queries').then(m => m.getPaymentRecords())
          setPayments(updated)
        }
      }
    } finally {
      setSyncing(false)
    }
  }

  const totalPayments = payments.reduce((s, r) => s + r.amount, 0)
  const unpaidProjects = projects.filter(
    p => p.status === '請求済み' || (p.probability === '確定' && p.status === '進行中')
  )

  return (
    <div className="space-y-5">
      <PaymentFormModal
        open={paymentModalOpen || !!editTarget}
        onClose={() => { setPaymentModalOpen(false); setEditTarget(undefined) }}
        onSave={handleSavePayment}
        initial={editTarget}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="入金記録を削除"
        message={`「${deleteTarget?.project_name}」の入金記録を削除します。`}
        onConfirm={handleDeletePayment}
        onCancel={() => setDeleteTarget(undefined)}
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
              style={activeTab === tab ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}
            >
              {tab}
            </button>
          ))}
        </div>
        <button onClick={handleMfSync} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'MF同期中...' : 'MF入金同期'}
        </button>
      </div>

      {syncMsg && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: syncMsg.startsWith('✓') ? '#F0FDF4' : '#FEF2F2',
            color: syncMsg.startsWith('✓') ? '#16A34A' : '#EF4444' }}>
          <AlertCircle size={12} />
          {syncMsg}
        </div>
      )}

      {loading && (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          <p className="text-sm">読み込み中...</p>
        </div>
      )}

      {!loading && activeTab === '入金記録' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>入金総額</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(totalPayments)}</p>
            </Card>
            <Card>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>入金件数</p>
              <p className="text-2xl font-bold">{payments.length}件</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">入金記録一覧</h3>
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: 'var(--primary)' }}
              >
                <Plus size={13} />入金登録
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                  {['プロジェクト名', '顧客名', '入金日', '入金額', '入金月', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((record, i) => (
                  <tr key={record.id}
                    onClick={() => setEditTarget(record)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors group"
                    style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3 font-medium">{record.project_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs"
                        style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        {record.client_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{record.payment_date}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent)' }}>{formatCurrency(record.amount)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{record.payment_month}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(record) }}
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
        </div>
      )}

      {!loading && activeTab === '請求管理' && (
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
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unpaidProjects.map((project, i) => (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: i < unpaidProjects.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-4 py-3 font-medium max-w-[200px]"><span className="block truncate">{project.name}</span></td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                      {project.client_name}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(project.amount)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{project.invoice_month ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{project.payment_month ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
