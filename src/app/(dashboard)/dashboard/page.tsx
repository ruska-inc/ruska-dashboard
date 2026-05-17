'use client'

import { useState, useEffect, useMemo } from 'react'
import { Project, PaymentRecord, ContractorAssignment, ProjectProbability } from '@/lib/types'
import { getProjects, getPaymentRecords, getContractorAssignments } from '@/lib/supabase/queries'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Receipt, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePeriods } from '@/lib/hooks/usePeriods'

const probabilityColors = ['#F59E0B', '#F97316', '#38BDF8', '#6366F1', '#EF4444', '#9CA3AF']

type ChartItem = { name: string; client?: string; amount: number }
type MonthBucket = { total: number; items: ChartItem[] }
type ChartDatum = { month: string; value: number; items: ChartItem[] }

function parseMonth(label: string) {
  const m = label.match(/(\d+)年(\d+)月/)
  if (!m) return 0
  return parseInt(m[1]) * 100 + parseInt(m[2])
}

function toChartData(record: Record<string, MonthBucket>): ChartDatum[] {
  return Object.entries(record)
    .sort(([a], [b]) => parseMonth(a) - parseMonth(b))
    .map(([month, v]) => ({ month, value: v.total, items: v.items }))
}

function PanelHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="font-semibold text-base">{label}</p>
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--muted)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ItemList({ items, maxHeight = 224 }: { items: ChartItem[]; maxHeight?: number }) {
  if (items.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--muted)' }}>—</p>
  }
  return (
    <div className="space-y-1.5 overflow-auto pr-1" style={{ maxHeight }}>
      {items.map((it, i) => (
        <div key={i} className="flex justify-between gap-3 text-xs">
          <span className="truncate">
            {it.client && <span style={{ color: 'var(--muted)' }}>{it.client} / </span>}
            {it.name}
          </span>
          <span className="font-medium whitespace-nowrap">{formatCurrency(it.amount)}</span>
        </div>
      ))}
    </div>
  )
}

const panelClass = 'absolute z-50 bg-white border rounded-lg p-4 shadow-xl text-sm'
const panelBaseStyle = { borderColor: 'var(--border)' as string }

function PinnedSimplePanel({ label, color, total, items, onClose }: {
  label: string
  color: string
  total: number
  items: ChartItem[]
  onClose: () => void
}) {
  return (
    <div
      className={panelClass}
      style={{ ...panelBaseStyle, top: 12, right: 12, width: 360, maxWidth: 'calc(100% - 24px)' }}
    >
      <PanelHeader label={label} onClose={onClose} />
      <p className="mb-3 font-semibold" style={{ color }}>
        合計: {formatCurrency(total)}
      </p>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <ItemList items={items} maxHeight={192} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [assignments, setAssignments] = useState<ContractorAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('全期')
  const [invoicePinned, setInvoicePinned] = useState<string | null>(null)
  const [paymentPinned, setPaymentPinned] = useState<string | null>(null)
  const [outsourcePinned, setOutsourcePinned] = useState<string | null>(null)
  const [probabilityPinned, setProbabilityPinned] = useState<string | null>(null)
  const { periods } = usePeriods()

  const toggle = (setter: React.Dispatch<React.SetStateAction<string | null>>) =>
    (key: string | null | undefined) => {
      if (!key) return
      setter(prev => (prev === key ? null : key))
    }

  useEffect(() => {
    if (periods.length > 0) setSelectedPeriod(periods[0].name)
  }, [periods])

  useEffect(() => {
    Promise.all([getProjects(), getPaymentRecords(), getContractorAssignments()])
      .then(([p, pay, a]) => {
        setProjects(p)
        setPayments(pay)
        setAssignments(a)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredProjects = useMemo(() =>
    selectedPeriod === '全期' ? projects : projects.filter(p => p.period === selectedPeriod),
    [projects, selectedPeriod])

  const confirmedTotal = useMemo(() =>
    filteredProjects.filter(p => p.probability === '確定' && p.status !== '失注')
      .reduce((s, p) => s + p.amount, 0), [filteredProjects])

  const prospectTotal = useMemo(() =>
    filteredProjects.filter(p => ['確度（低）', '確度（中）', '確度（高）'].includes(p.probability))
      .reduce((s, p) => s + p.amount, 0), [filteredProjects])

  const taxTotal = useMemo(() =>
    filteredProjects.filter(p => p.probability === '確定' && p.status !== '失注')
      .reduce((s, p) => s + p.tax_amount, 0), [filteredProjects])

  const filteredPayments = useMemo(() =>
    selectedPeriod === '全期' ? payments : payments.filter(p => p.period === selectedPeriod),
    [payments, selectedPeriod])

  const filteredAssignments = useMemo(() =>
    selectedPeriod === '全期' ? assignments : assignments.filter(a => a.period === selectedPeriod),
    [assignments, selectedPeriod])

  const outsourceByMonth = useMemo(() =>
    filteredAssignments.reduce<Record<string, MonthBucket>>((acc, a) => {
      if (!a.invoice_month) return acc
      const m = a.invoice_month
      if (!acc[m]) acc[m] = { total: 0, items: [] }
      acc[m].total += a.amount_incl_tax
      acc[m].items.push({ name: a.project_name, amount: a.amount_incl_tax })
      return acc
    }, {}), [filteredAssignments])

  const invoiceByMonth = useMemo(() =>
    filteredProjects.reduce<Record<string, MonthBucket>>((acc, p) => {
      if (!p.invoice_month || p.probability !== '確定') return acc
      const m = p.invoice_month
      if (!acc[m]) acc[m] = { total: 0, items: [] }
      const inclTax = p.amount + p.tax_amount
      acc[m].total += inclTax
      acc[m].items.push({ name: p.name, client: p.client_name, amount: inclTax })
      return acc
    }, {}), [filteredProjects])

  const paymentByMonth = useMemo(() =>
    filteredPayments.reduce<Record<string, MonthBucket>>((acc, r) => {
      const m = r.payment_month
      if (!acc[m]) acc[m] = { total: 0, items: [] }
      acc[m].total += r.amount
      acc[m].items.push({ name: r.project_name, client: r.client_name, amount: r.amount })
      return acc
    }, {}), [filteredPayments])

  const probabilityData = useMemo(() => {
    const buckets: { key: ProjectProbability; label: string }[] = [
      { key: '確度（低）', label: '確度（低）' },
      { key: '確度（中）', label: '確度（中）' },
      { key: '確度（高）', label: '確度（高）' },
      { key: '確定', label: '確定' },
      { key: '保留・トラブル有り', label: '保留' },
      { key: '失注', label: '失注' },
    ]
    return buckets.map(({ key, label }) => {
      const matched = filteredProjects.filter(p => p.probability === key)
      return {
        name: label,
        value: matched.reduce((s, p) => s + p.amount, 0),
        items: matched.map(p => ({ name: p.name, client: p.client_name, amount: p.amount })),
      }
    })
  }, [filteredProjects])

  const troubleProjects = useMemo(() =>
    filteredProjects.filter(p => p.probability === '保留・トラブル有り'), [filteredProjects])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 期フィルター */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {[...periods.map(p => p.name), '全期'].map(p => (
          <button key={p} onClick={() => setSelectedPeriod(p)}
            className={cn('px-4 py-1.5 text-xs font-medium rounded-md transition-all')}
            style={selectedPeriod === p ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
            {p}
          </button>
        ))}
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>確定案件総額</p>
              <p className="text-3xl font-bold" style={{ color: '#F97316' }}>
                {formatCurrency(confirmedTotal)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#FFF7ED' }}>
              <TrendingUp size={20} style={{ color: '#F97316' }} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>見込み案件総額</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(prospectTotal)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
              <TrendingDown size={20} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>税総額</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(taxTotal)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.35)' }}>
              <Receipt size={20} style={{ color: 'var(--muted)' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* グラフ */}
      <div className="grid grid-cols-2 gap-4">
        <Card className={cn('relative', invoicePinned ? 'z-50' : 'z-0')}>
          <CardHeader><CardTitle>月ごとの請求額(税込)</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={toChartData(invoiceByMonth)}
              onClick={(s: any) => toggle(setInvoicePinned)(s?.activeLabel)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={() => null} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
          {invoicePinned && invoiceByMonth[invoicePinned] && (
            <PinnedSimplePanel
              label={invoicePinned}
              color="#3B82F6"
              total={invoiceByMonth[invoicePinned].total}
              items={invoiceByMonth[invoicePinned].items}
              onClose={() => setInvoicePinned(null)}
            />
          )}
        </Card>

        <Card className={cn('relative', paymentPinned ? 'z-50' : 'z-0')}>
          <CardHeader><CardTitle>月ごとの入金額</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={toChartData(paymentByMonth)}
              onClick={(s: any) => toggle(setPaymentPinned)(s?.activeLabel)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={() => null} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
          {paymentPinned && paymentByMonth[paymentPinned] && (
            <PinnedSimplePanel
              label={paymentPinned}
              color="var(--accent)"
              total={paymentByMonth[paymentPinned].total}
              items={paymentByMonth[paymentPinned].items}
              onClose={() => setPaymentPinned(null)}
            />
          )}
        </Card>

        <Card className={cn('relative', outsourcePinned ? 'z-50' : 'z-0')}>
          <CardHeader><CardTitle>月ごとの外注費用</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={toChartData(outsourceByMonth)}
              onClick={(s: any) => toggle(setOutsourcePinned)(s?.activeLabel)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={() => null} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
          {outsourcePinned && outsourceByMonth[outsourcePinned] && (
            <PinnedSimplePanel
              label={outsourcePinned}
              color="#8B5CF6"
              total={outsourceByMonth[outsourcePinned].total}
              items={outsourceByMonth[outsourcePinned].items}
              onClose={() => setOutsourcePinned(null)}
            />
          )}
        </Card>

        <Card className={cn('relative', probabilityPinned ? 'z-50' : 'z-0')}>
          <CardHeader><CardTitle>確度別の総額</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={probabilityData}
              onClick={(s: any) => toggle(setProbabilityPinned)(s?.activeLabel)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={() => null} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }}>
                {probabilityData.map((_, index) => (
                  <Cell key={index} fill={probabilityColors[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {probabilityPinned && (() => {
            const d = probabilityData.find(p => p.name === probabilityPinned)
            if (!d) return null
            return (
              <PinnedSimplePanel
                label={probabilityPinned}
                color={probabilityColors[probabilityData.indexOf(d)] ?? '#6366F1'}
                total={d.value}
                items={d.items}
                onClose={() => setProbabilityPinned(null)}
              />
            )
          })()}
        </Card>
      </div>

      {/* 要注意案件 */}
      <Card>
        <CardHeader>
          <CardTitle>要注意案件</CardTitle>
          <span className="flex items-center gap-1 text-xs" style={{ color: '#EF4444' }}>
            <AlertCircle size={14} />
            保留・トラブル有り
          </span>
        </CardHeader>
        <div className="space-y-2">
          {troubleProjects.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: 'rgba(254,226,226,0.70)' }}>
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.client_name}</p>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                {formatCurrency(p.amount)}
              </p>
            </div>
          ))}
          {troubleProjects.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>
              要注意案件はありません
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
