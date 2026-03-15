'use client'

import { mockProjects, mockPaymentRecords, mockContractorAssignments } from '@/lib/mock-data'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Receipt, AlertCircle } from 'lucide-react'

// 確定案件総額
const confirmedTotal = mockProjects
  .filter(p => p.probability === '確定' && p.status !== '失注')
  .reduce((sum, p) => sum + p.amount, 0)

// 見込み案件総額
const prospectTotal = mockProjects
  .filter(p => ['確度（低）', '確度（中）', '確度（高）'].includes(p.probability))
  .reduce((sum, p) => sum + p.amount, 0)

// 税総額
const taxTotal = mockProjects
  .filter(p => p.probability === '確定' && p.status !== '失注')
  .reduce((sum, p) => sum + p.tax_amount, 0)

// 月ごとの入金額
const paymentByMonth = mockPaymentRecords.reduce<Record<string, number>>((acc, r) => {
  acc[r.payment_month] = (acc[r.payment_month] || 0) + r.amount
  return acc
}, {})

// 月ごとの請求額
const invoiceByMonth = mockProjects
  .filter(p => p.invoice_month && p.probability === '確定')
  .reduce<Record<string, number>>((acc, p) => {
    if (p.invoice_month) {
      acc[p.invoice_month] = (acc[p.invoice_month] || 0) + p.amount
    }
    return acc
  }, {})

// 月ごとの外注費用
const outsourceByMonth = mockContractorAssignments.reduce<Record<string, number>>((acc, a) => {
  if (a.invoice_month) {
    acc[a.invoice_month] = (acc[a.invoice_month] || 0) + a.amount_excl_tax
  }
  return acc
}, {})

// 確度別の総額
const probabilityData = [
  { name: '確度（低）', value: mockProjects.filter(p => p.probability === '確度（低）').reduce((s, p) => s + p.amount, 0) },
  { name: '確度（中）', value: mockProjects.filter(p => p.probability === '確度（中）').reduce((s, p) => s + p.amount, 0) },
  { name: '確度（高）', value: mockProjects.filter(p => p.probability === '確度（高）').reduce((s, p) => s + p.amount, 0) },
  { name: '確定', value: mockProjects.filter(p => p.probability === '確定').reduce((s, p) => s + p.amount, 0) },
  { name: '保留', value: mockProjects.filter(p => p.probability === '保留・トラブル有り').reduce((s, p) => s + p.amount, 0) },
  { name: '失注', value: mockProjects.filter(p => p.probability === '失注').reduce((s, p) => s + p.amount, 0) },
]

const probabilityColors = ['#F59E0B', '#F97316', '#3B82F6', '#7A9E7E', '#EF4444', '#9CA3AF']

function toChartData(record: Record<string, number>) {
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }))
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border rounded-lg p-3 shadow-lg text-sm" style={{ borderColor: 'var(--border)' }}>
        <p className="font-medium mb-1">{label}</p>
        <p style={{ color: 'var(--accent)' }}>{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
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
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#F9FAFB' }}>
              <Receipt size={20} style={{ color: 'var(--muted)' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* グラフ 2列 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 月ごとの入金額 */}
        <Card>
          <CardHeader>
            <CardTitle>月ごとの入金額</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={toChartData(paymentByMonth)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* 月ごとの請求額 */}
        <Card>
          <CardHeader>
            <CardTitle>月ごとの請求額</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={toChartData(invoiceByMonth)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* 月ごとの外注費用 */}
        <Card>
          <CardHeader>
            <CardTitle>月ごとの外注費用</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={toChartData(outsourceByMonth)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* 確度別総額 */}
        <Card>
          <CardHeader>
            <CardTitle>確度別の総額</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={probabilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip content={<CustomTooltip />} />
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
          {mockProjects
            .filter(p => p.probability === '保留・トラブル有り')
            .map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ background: '#FEF2F2' }}
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.client_name}</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                  {formatCurrency(p.amount)}
                </p>
              </div>
            ))}
          {mockProjects.filter(p => p.probability === '保留・トラブル有り').length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>
              要注意案件はありません
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
