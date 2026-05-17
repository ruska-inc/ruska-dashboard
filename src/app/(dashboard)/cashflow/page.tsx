'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Upload, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, FileSpreadsheet, Calendar } from 'lucide-react'
import { usePeriods } from '@/lib/hooks/usePeriods'
import type { BankAccount, BankTransaction } from '@/lib/types'
import {
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getBankTransactions, createBankTransaction, updateBankTransaction, deleteBankTransaction,
} from '@/lib/supabase/queries'
import TransactionImportModal from '@/components/cashflow/TransactionImportModal'
import TransactionFormModal from '@/components/cashflow/TransactionFormModal'
import AccountFormModal from '@/components/cashflow/AccountFormModal'
import SheetImportModal from '@/components/cashflow/SheetImportModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SortableTh from '@/components/ui/SortableTh'
import { useSortable } from '@/lib/hooks/useSortable'

const tabs = ['取引明細', '月次集計', '口座マスタ']

const SOURCE_LABELS: Record<string, string> = {
  manual: '手動',
  csv_sbi: 'SBI CSV',
  csv_smbc: '三井住友 CSV',
  csv_generic: '汎用 CSV',
  sheet_import: 'シート取込',
}

export default function CashflowPage() {
  const [activeTab, setActiveTab] = useState('取引明細')
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [monthlyPeriod, setMonthlyPeriod] = useState<string>('all')
  const { periods } = usePeriods()

  const [importOpen, setImportOpen] = useState(false)
  const [sheetImportOpen, setSheetImportOpen] = useState(false)
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editTx, setEditTx] = useState<BankTransaction | undefined>()
  const [deleteTx, setDeleteTx] = useState<BankTransaction | undefined>()

  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<BankAccount | undefined>()
  const [deleteAccount, setDeleteAccount] = useState<BankAccount | undefined>()

  useEffect(() => {
    Promise.all([getBankAccounts(), getBankTransactions()])
      .then(([a, t]) => { setAccounts(a); setTransactions(t) })
      .finally(() => setLoading(false))
  }, [])

  // === 取引 ===
  const handleSaveTransaction = async (input: Omit<BankTransaction, 'id' | 'created_at' | 'account'>) => {
    if (editTx) {
      const updated = await updateBankTransaction(editTx.id, input)
      setTransactions(prev => prev.map(t => t.id === editTx.id ? updated : t))
      setEditTx(undefined)
    } else {
      const created = await createBankTransaction(input)
      setTransactions(prev => [created, ...prev])
    }
  }

  const handleDeleteTransaction = async () => {
    if (!deleteTx) return
    await deleteBankTransaction(deleteTx.id)
    setTransactions(prev => prev.filter(t => t.id !== deleteTx.id))
    setDeleteTx(undefined)
  }

  // === 口座 ===
  const handleSaveAccount = async (input: { name: string; sort_order: number }) => {
    if (editAccount) {
      const updated = await updateBankAccount(editAccount.id, input)
      setAccounts(prev => prev.map(a => a.id === editAccount.id ? updated : a))
      setEditAccount(undefined)
    } else {
      const created = await createBankAccount(input)
      setAccounts(prev => [...prev, created].sort((a, b) => a.sort_order - b.sort_order))
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteAccount) return
    await deleteBankAccount(deleteAccount.id)
    setAccounts(prev => prev.filter(a => a.id !== deleteAccount.id))
    setTransactions(prev => prev.filter(t => t.account_id !== deleteAccount.id))
    setDeleteAccount(undefined)
  }

  // === フィルタリング ===
  const filteredTransactions = useMemo(() =>
    accountFilter === 'all' ? transactions : transactions.filter(t => t.account_id === accountFilter),
    [transactions, accountFilter])

  const totalIncome = filteredTransactions.reduce((s, t) => s + t.income, 0)
  const totalExpense = filteredTransactions.reduce((s, t) => s + t.expense, 0)
  const netCashflow = totalIncome - totalExpense

  // === ソート ===
  const txSort = useSortable(
    filteredTransactions,
    {
      transaction_date: t => t.transaction_date,
      account: t => t.account?.name ?? '',
      description: t => t.description ?? '',
      expense: t => t.expense,
      income: t => t.income,
      source: t => t.source,
    },
    { key: 'transaction_date', dir: 'desc' },
  )

  // === 月次集計 ===
  type MonthlyAgg = {
    yearMonth: string
    label: string
    expense: number
    income: number
    netChange: number
    balance: number
  }

  const allMonthly = useMemo<MonthlyAgg[]>(() => {
    // filteredTransactions (口座フィルター反映済み) を月別に集計
    const map: Record<string, { expense: number; income: number }> = {}
    for (const t of filteredTransactions) {
      const ym = t.transaction_date.slice(0, 7)
      if (!map[ym]) map[ym] = { expense: 0, income: 0 }
      map[ym].expense += t.expense
      map[ym].income += t.income
    }
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    let balance = 0
    return sorted.map(([ym, { expense, income }]) => {
      const netChange = income - expense
      balance += netChange
      const year = parseInt(ym.slice(0, 4), 10)
      const month = parseInt(ym.slice(5, 7), 10)
      return {
        yearMonth: ym,
        label: `${year}年${month}月`,
        expense,
        income,
        netChange,
        balance,
      }
    })
  }, [filteredTransactions])

  const monthlyByPeriod = useMemo(() => {
    if (monthlyPeriod === 'all') return allMonthly
    const sortedPeriods = [...periods]
      .filter(p => p.start_year_month)
      .sort((a, b) => (a.start_year_month ?? '').localeCompare(b.start_year_month ?? ''))
    const idx = sortedPeriods.findIndex(p => p.name === monthlyPeriod)
    if (idx < 0) return allMonthly
    const start = sortedPeriods[idx].start_year_month!
    const end = idx + 1 < sortedPeriods.length ? sortedPeriods[idx + 1].start_year_month! : null
    return allMonthly.filter(m => m.yearMonth >= start && (end === null || m.yearMonth < end))
  }, [allMonthly, monthlyPeriod, periods])

  const periodTotal = useMemo(() => ({
    expense: monthlyByPeriod.reduce((s, m) => s + m.expense, 0),
    income: monthlyByPeriod.reduce((s, m) => s + m.income, 0),
    netChange: monthlyByPeriod.reduce((s, m) => s + m.netChange, 0),
  }), [monthlyByPeriod])

  const accountTxCount = useMemo(() => {
    const counts: Record<string, number> = {}
    transactions.forEach(t => { counts[t.account_id] = (counts[t.account_id] ?? 0) + 1 })
    return counts
  }, [transactions])

  return (
    <div className="space-y-5">
      <TransactionImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        onImported={imported => setTransactions(prev => [...imported, ...prev])}
      />
      <SheetImportModal
        open={sheetImportOpen}
        onClose={() => setSheetImportOpen(false)}
        accounts={accounts}
        onImported={(imported, newAccts) => {
          setTransactions(prev => [...imported, ...prev])
          if (newAccts.length > 0) setAccounts(prev => [...prev, ...newAccts].sort((a, b) => a.sort_order - b.sort_order))
        }}
      />
      <TransactionFormModal
        open={txModalOpen || !!editTx}
        onClose={() => { setTxModalOpen(false); setEditTx(undefined) }}
        accounts={accounts}
        onSave={handleSaveTransaction}
        initial={editTx}
      />
      <AccountFormModal
        open={accountModalOpen || !!editAccount}
        onClose={() => { setAccountModalOpen(false); setEditAccount(undefined) }}
        onSave={handleSaveAccount}
        initial={editAccount}
      />
      <ConfirmDialog
        open={!!deleteTx}
        title="取引を削除"
        message={`${deleteTx?.transaction_date} の取引を削除します。`}
        onConfirm={handleDeleteTransaction}
        onCancel={() => setDeleteTx(undefined)}
      />
      <ConfirmDialog
        open={!!deleteAccount}
        title="口座を削除"
        message={`「${deleteAccount?.name}」と紐づく全ての取引を削除します。`}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteAccount(undefined)}
      />

      {/* タブ + 口座フィルター */}
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
        {activeTab === '取引明細' && accounts.length > 0 && (
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <button onClick={() => setAccountFilter('all')}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
              style={accountFilter === 'all' ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
              全口座
            </button>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setAccountFilter(a.id)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
                style={accountFilter === a.id ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}>
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="text-center py-16"><p className="text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</p></div>}

      {/* === 取引明細タブ === */}
      {!loading && activeTab === '取引明細' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>入金合計</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                  <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>出金合計</p>
                  <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>{formatCurrency(totalExpense)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(254,226,226,0.55)' }}>
                  <TrendingDown size={18} style={{ color: '#EF4444' }} />
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>収支差引</p>
                  <p className="text-2xl font-bold" style={{ color: netCashflow >= 0 ? 'var(--accent)' : '#EF4444' }}>
                    {netCashflow >= 0 ? '+' : ''}{formatCurrency(netCashflow)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.35)' }}>
                  <Wallet size={18} style={{ color: 'var(--muted)' }} />
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">取引一覧 ({filteredTransactions.length}件)</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSheetImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <FileSpreadsheet size={13} />スプレッドシート一括取込
                </button>
                <button
                  onClick={() => setImportOpen(true)}
                  disabled={accounts.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <Upload size={13} />CSV取り込み
                </button>
                <button
                  onClick={() => { setEditTx(undefined); setTxModalOpen(true) }}
                  disabled={accounts.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  <Plus size={13} />取引追加
                </button>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
                取引データがありません。CSVを取り込むか、手動で追加してください。
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                    <SortableTh label="日付" sortKey="transaction_date" currentKey={txSort.sortKey} dir={txSort.sortDir} onSort={txSort.toggle} />
                    <SortableTh label="口座" sortKey="account" currentKey={txSort.sortKey} dir={txSort.sortDir} onSort={txSort.toggle} />
                    <SortableTh label="摘要" sortKey="description" currentKey={txSort.sortKey} dir={txSort.sortDir} onSort={txSort.toggle} />
                    <SortableTh label="出金" sortKey="expense" currentKey={txSort.sortKey} dir={txSort.sortDir} onSort={txSort.toggle} />
                    <SortableTh label="入金" sortKey="income" currentKey={txSort.sortKey} dir={txSort.sortDir} onSort={txSort.toggle} />
                    <SortableTh label="入力元" sortKey="source" currentKey={txSort.sortKey} dir={txSort.sortDir} onSort={txSort.toggle} />
                    <SortableTh label="" />
                  </tr>
                </thead>
                <tbody>
                  {txSort.sorted.map((t, i) => (
                    <tr key={t.id}
                      onClick={() => setEditTx(t)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors group"
                      style={{ borderBottom: i < txSort.sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{t.transaction_date}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          {t.account?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[280px]">
                        <span className="block truncate text-xs">{t.description ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: t.expense > 0 ? '#EF4444' : 'var(--muted)' }}>
                        {t.expense > 0 ? formatCurrency(t.expense) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: t.income > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                        {t.income > 0 ? formatCurrency(t.income) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{SOURCE_LABELS[t.source] ?? t.source}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={e => { e.stopPropagation(); setDeleteTx(t) }}
                          className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                          style={{ color: '#EF4444' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* === 月次集計タブ === */}
      {!loading && activeTab === '月次集計' && (
        <div className="space-y-4">
          {/* 期フィルター */}
          <div className="flex items-center gap-3">
            <Calendar size={14} style={{ color: 'var(--muted)' }} />
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setMonthlyPeriod('all')}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
                style={monthlyPeriod === 'all' ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}
              >
                全期間
              </button>
              {[...periods]
                .filter(p => p.start_year_month)
                .sort((a, b) => (b.start_year_month ?? '').localeCompare(a.start_year_month ?? ''))
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => setMonthlyPeriod(p.name)}
                    className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
                    style={monthlyPeriod === p.name ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {accountFilter === 'all' ? '全口座' : `口座: ${accounts.find(a => a.id === accountFilter)?.name ?? ''}`}
            </span>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">
                月次集計
                {monthlyPeriod !== 'all' && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>({monthlyPeriod})</span>}
              </h3>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{monthlyByPeriod.length}ヶ月</span>
            </div>

            {monthlyByPeriod.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
                該当期間のデータがありません
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                    <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>年月</th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>費用</th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>収入</th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>入出金差引額</th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>口座残高</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyByPeriod.map((m, i) => (
                    <tr key={m.yearMonth}
                      style={{ borderBottom: i < monthlyByPeriod.length - 1 ? '1px solid var(--border)' : 'none' }}
                      className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{m.label}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: m.expense > 0 ? '#EF4444' : 'var(--muted)' }}>
                        {m.expense > 0 ? formatCurrency(m.expense) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: m.income > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                        {m.income > 0 ? formatCurrency(m.income) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: m.netChange >= 0 ? 'var(--accent)' : '#EF4444' }}>
                        {m.netChange >= 0 ? '+' : ''}{formatCurrency(m.netChange)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(m.balance)}</td>
                    </tr>
                  ))}
                  {monthlyPeriod !== 'all' && (
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(245,245,250,0.6)' }}>
                      <td className="px-4 py-3 font-semibold text-xs" style={{ color: 'var(--muted)' }}>{monthlyPeriod} 合計</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: '#EF4444' }}>{formatCurrency(periodTotal.expense)}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--accent)' }}>{formatCurrency(periodTotal.income)}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: periodTotal.netChange >= 0 ? 'var(--accent)' : '#EF4444' }}>
                        {periodTotal.netChange >= 0 ? '+' : ''}{formatCurrency(periodTotal.netChange)}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* === 口座マスタタブ === */}
      {!loading && activeTab === '口座マスタ' && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold">口座マスタ</h3>
            <button
              onClick={() => { setEditAccount(undefined); setAccountModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: 'var(--primary)' }}>
              <Plus size={13} />口座追加
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                {['口座名', '表示順', '取引件数', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={a.id}
                  onClick={() => setEditAccount(a)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors group"
                  style={{ borderBottom: i < accounts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{a.sort_order}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{accountTxCount[a.id] ?? 0}件</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setEditAccount(a) }}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100"
                        style={{ color: 'var(--muted)' }}><Pencil size={12} /></button>
                      <button onClick={e => { e.stopPropagation(); setDeleteAccount(a) }}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"
                        style={{ color: '#EF4444' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-xs" style={{ color: 'var(--muted)' }}>口座がまだありません</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
