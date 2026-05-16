'use client'

import { useState, useEffect, useMemo } from 'react'
import { Project, PaymentRecord, ContractorAssignment, ProjectProbability } from '@/lib/types'
import { getProjects, getPaymentRecords, getContractorAssignments } from '@/lib/supabase/queries'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Receipt, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePeriods } from '@/lib/hooks/usePeriods'

const probabilityColors = ['#F59E0B', '#F97316', '#38BDF8', '#6366F1', '#EF4444', '#9CA3AF']

type ChartItem = { name: string; client?: string; amount: number }
type MonthBucket = { total: number; items: ChartItem[] }
type ChartDatum = { month: string; value: number; items: ChartItem[] }
type CombinedBucket = {
  invoice: number
  payment: number
  invoiceItems: ChartItem[]
  paymentItems: ChartItem[]
}
type CombinedDatum = { month: string } & CombinedBucket

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

function toCombinedChartData(record: Record<string, CombinedBucket>): CombinedDatum[] {
  return Object.entries(record)
    .sort(([a], [b]) => parseMonth(a) - parseMonth(b))
    .map(([month, v]) => ({ month, ...v }))
}

const CombinedTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload as CombinedDatum | undefined
  if (!data) return null
  return (
    <div
      className="bg-white border rounded-lg p-4 shadow-xl text-sm"
      style={{ borderColor: 'var(--border)', width: 720, maxWidth: '92vw' }}
    >
      <p className="font-semibold mb-3 text-base">{label}</p>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="font-semibold mb-2 pb-1.5" style={{ color: '#3B82F6', borderBottom: '1px solid var(--border)' }}>
            請求(税込) {formatCurrency(data.invoice)}
          </p>
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {data.invoiceItems.length === 0 && (
              <p style={{ color: 'var(--muted)' }}>—</p>
            )}
            {data.invoiceItems.map((it, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {it.client && <span style={{ color: 'var(--muted)' }}>{it.client} / </span>}
                  {it.name}
                </span>
                <span className="font-medium whitespace-nowrap">{formatCurrency(it.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="font-semibold mb-2 pb-1.5" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}>
            入金 {formatCurrency(data.payment)}
          </p>
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {data.paymentItems.length === 0 && (
              <p style={{ color: 'var(--muted)' }}>—</p>
            )}
            {data.paymentItems.map((it, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {it.client && <span style={{ color: 'var(--muted)' }}>{it.client} / </span>}
                  {it.name}
                </span>
                <span className="font-medium whitespace-nowrap">{formatCurrency(it.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const items: ChartItem[] = payload[0].payload?.items ?? []
    return (
      <div
        className="bg-white border rounded-lg p-4 shadow-xl text-sm"
        style={{ borderColor: 'var(--border)', width: 420, maxWidth: '90vw' }}
      >
        <p className="font-semibold mb-2 text-base">{label}</p>
        <p className="mb-3 font-semibold" style={{ color: 'var(--accent)' }}>
          合計: {formatCurrency(payload[0].value)}
        </p>
        {items.length > 0 && (
          <div className="space-y-1.5 max-h-64 overflow-auto pr-1" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            {items.map((it, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {it.client && (
                    <span style={{ color: 'var(--muted)' }}>{it.client} / </span>
                  )}
                  {it.name}
                </span>
                <span className="font-medium whitespace-nowrap">
                  {formatCurrency(it.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [assignments, setAssignments] = useState<ContractorAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('全期')
  const { periods } = usePeriods()

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

  const combinedByMonth = useMemo(() => {
    const buckets: Record<string, CombinedBucket> = {}
    const get = (m: string) => {
      if (!buckets[m]) buckets[m] = { invoice: 0, payment: 0, invoiceItems: [], paymentItems: [] }
      return buckets[m]
    }
    filteredProjects.forEach(p => {
      if (!p.invoice_month || p.probability !== '確定') return
      const b = get(p.invoice_month)
      const inclTax = p.amount + p.tax_amount
      b.invoice += inclTax
      b.invoiceItems.push({ name: p.name, client: p.client_name, amount: inclTax })
    })
    filteredPayments.forEach(r => {
      const b = get(r.payment_month)
      b.payment += r.amount
      b.paymentItems.push({ name: r.project_name, client: r.client_name, amount: r.amount })
    })
    return buckets
  }, [filteredProjects, filteredPayments])

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
        <Card className="col-span-2 relative z-0 hover:z-50">
          <CardHeader>
            <CardTitle>月ごとの請求 / 入金</CardTitle>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              請求月と入金月のズレ・未入金分が一目で分かります
            </span>
          </CardHeader>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={toCombinedChartData(combinedByMonth)} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={<CombinedTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} wrapperStyle={{ zIndex: 9999, outline: 'none' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="invoice" name="請求額(税込)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="payment" name="入金額" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="relative z-0 hover:z-50">
          <CardHeader><CardTitle>月ごとの外注費用</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={toChartData(outsourceByMonth)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999, outline: 'none' }} />
              <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="relative z-0 hover:z-50">
          <CardHeader><CardTitle>確度別の総額</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={probabilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999, outline: 'none' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {probabilityData.map((_, index) => (
                  <Cell key={index} fill={probabilityColors[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
