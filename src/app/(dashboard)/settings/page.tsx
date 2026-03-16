'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { UserRole } from '@/lib/types'
import { Shield, User, Plus, Download, Mail, Trash2, CalendarDays, Link2, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { getAllProfiles, updateProfileRole, getPeriods, createPeriod, deletePeriod } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { PeriodSetting } from '@/lib/types'

const roleLabels: Record<UserRole, string> = {
  admin: '管理者',
  management: '経営管理',
  accounting: '経理メンバー',
  internal: '社内メンバー',
  contractor: '業務委託メンバー',
}

const roleDescriptions: Record<UserRole, string> = {
  admin: '全機能フルアクセス・ユーザー管理',
  management: '売上・プロジェクト・業務委託 閲覧・編集',
  accounting: '売上・支払い管理メイン、プロジェクトは閲覧のみ',
  internal: '担当プロジェクトのみ編集、売上は閲覧不可',
  contractor: '自分がアサインされた案件のみ閲覧',
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [periods, setPeriods] = useState<PeriodSetting[]>([])
  const [newPeriodName, setNewPeriodName] = useState('')
  const [addingPeriod, setAddingPeriod] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('internal')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [showInviteForm, setShowInviteForm] = useState(false)

  // MoneyForward
  const [mfStatus, setMfStatus] = useState<{ connected: boolean; accountCount?: number; error?: string } | null>(null)
  const [mfAccounts, setMfAccounts] = useState<any[]>([])
  const [mfChecking, setMfChecking] = useState(false)
  const [mfSyncing, setMfSyncing] = useState(false)
  const [mfSyncResult, setMfSyncResult] = useState<string>('')

  useEffect(() => {
    getAllProfiles().then(setProfiles).catch(() => {})
    getPeriods().then(setPeriods).catch(() => {})
  }, [])

  const handleMfCheck = async () => {
    setMfChecking(true)
    setMfSyncResult('')
    try {
      const [statusRes, accountsRes] = await Promise.all([
        fetch('/api/moneyforward/status'),
        fetch('/api/moneyforward/accounts'),
      ])
      const status = await statusRes.json()
      const accountData = await accountsRes.json()
      setMfStatus(status)
      setMfAccounts(accountData.accounts ?? [])
    } finally {
      setMfChecking(false)
    }
  }

  const handleMfSync = async () => {
    setMfSyncing(true)
    setMfSyncResult('')
    try {
      const res = await fetch('/api/moneyforward/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setMfSyncResult(`エラー: ${data.error}`)
      } else {
        setMfSyncResult(`✓ ${data.inserted}件の入金データを同期しました`)
      }
    } finally {
      setMfSyncing(false)
    }
  }

  const handleAddPeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPeriodName.trim()) return
    setAddingPeriod(true)
    try {
      const created = await createPeriod(newPeriodName.trim())
      setPeriods(prev => [created, ...prev])
      setNewPeriodName('')
    } finally {
      setAddingPeriod(false)
    }
  }

  const handleDeletePeriod = async (id: string) => {
    await deletePeriod(id)
    setPeriods(prev => prev.filter(p => p.id !== id))
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: inviteEmail,
        options: { data: { name: inviteName, role: inviteRole } },
      })
      if (error) throw error
      setInviteMsg(`✓ ${inviteEmail} に招待メールを送信しました`)
      setInviteEmail('')
      setInviteName('')
      setShowInviteForm(false)
    } catch (err: any) {
      setInviteMsg(`エラー: ${err.message}`)
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (id: string, role: UserRole) => {
    await updateProfileRole(id, role)
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, role } : p))
  }

  const handleExport = async (type: 'projects' | 'payments' | 'contractors') => {
    const supabase = createClient()
    const XLSX = await import('xlsx')

    let data: any[] = []
    let filename = ''

    if (type === 'projects') {
      const { data: d } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      data = (d ?? []).map(p => ({
        プロジェクト名: p.name, 顧客名: p.client_name,
        ステータス: p.status, 確度: p.probability,
        '金額（税抜）': p.amount, 税額: p.tax_amount,
        期: p.period, 請求月: p.invoice_month ?? '',
        支払月: p.payment_month ?? '', 備考: p.notes ?? '',
      }))
      filename = 'projects.xlsx'
    } else if (type === 'payments') {
      const { data: d } = await supabase.from('payment_records').select('*').order('payment_date', { ascending: false })
      data = (d ?? []).map(p => ({
        プロジェクト名: p.project_name, 顧客名: p.client_name,
        入金日: p.payment_date, 入金額: p.amount, 入金月: p.payment_month,
      }))
      filename = 'payment_records.xlsx'
    } else {
      const { data: d } = await supabase.from('contractor_assignments')
        .select('*, contractor:contractors(company_name, contact_name)')
        .order('created_at', { ascending: false })
      data = (d ?? []).map((a: any) => ({
        案件名: a.project_name,
        委託先: a.contractor?.company_name ?? '',
        担当者: a.contractor?.contact_name ?? '',
        '費用（税抜）': a.amount_excl_tax,
        '費用（税込）': a.amount_incl_tax,
        請求月: a.invoice_month ?? '',
        支払月: a.payment_month ?? '',
        振込状況: a.payment_status,
      }))
      filename = 'contractor_assignments.xlsx'
    }

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, filename)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ユーザー管理 */}
      <Card>
        <CardHeader>
          <CardTitle>ユーザー管理</CardTitle>
          <button onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--primary)' }}>
            <Plus size={13} />メンバー招待
          </button>
        </CardHeader>

        {/* 招待フォーム */}
        {showInviteForm && (
          <form onSubmit={handleInvite} className="mb-4 p-4 rounded-lg space-y-3"
            style={{ background: 'var(--accent-light)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              <Mail size={12} className="inline mr-1" />招待メールを送信します
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>名前</label>
                <input required value={inviteName} onChange={e => setInviteName(e.target.value)}
                  className={inputClass} style={inputStyle} placeholder="山田 太郎" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>メールアドレス</label>
                <input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  className={inputClass} style={inputStyle} placeholder="example@ruska.co.jp" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>ロール</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)}
                className={inputClass} style={inputStyle}>
                {(Object.keys(roleLabels) as UserRole[]).map(r => (
                  <option key={r} value={r}>{roleLabels[r]}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowInviteForm(false)}
                className="px-3 py-1.5 text-xs rounded-lg border hover:bg-white"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>キャンセル</button>
              <button type="submit" disabled={inviting}
                className="px-3 py-1.5 text-xs rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {inviting ? '送信中...' : '招待メールを送る'}
              </button>
            </div>
          </form>
        )}

        {inviteMsg && (
          <p className="text-xs mb-3 px-3 py-2 rounded-lg"
            style={{ background: inviteMsg.startsWith('✓') ? '#F0FDF4' : '#FEF2F2',
              color: inviteMsg.startsWith('✓') ? '#15803D' : '#EF4444' }}>
            {inviteMsg}
          </p>
        )}

        <div className="space-y-2">
          {profiles.map(user => (
            <div key={user.id} className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'var(--accent)' }}>
                  {user.name?.[0] ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{user.email}</p>
                </div>
              </div>
              <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                className="text-xs px-2 py-1 rounded-md border outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--accent-light)', color: 'var(--accent)' }}>
                {(Object.keys(roleLabels) as UserRole[]).map(r => (
                  <option key={r} value={r}>{roleLabels[r]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Card>

      {/* 期管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays size={16} style={{ color: 'var(--accent)' }} />
            <CardTitle>期の管理</CardTitle>
          </div>
        </CardHeader>

        <form onSubmit={handleAddPeriod} className="flex gap-2 mb-4">
          <input
            value={newPeriodName}
            onChange={e => setNewPeriodName(e.target.value)}
            placeholder="例: 第5期"
            className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <button type="submit" disabled={addingPeriod || !newPeriodName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}>
            <Plus size={13} />追加
          </button>
        </form>

        <div className="space-y-2">
          {periods.map(period => (
            <div key={period.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}>
              <span className="text-sm font-medium">{period.name}</span>
              <button onClick={() => handleDeletePeriod(period.id)}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"
                style={{ color: '#EF4444' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {periods.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>期が登録されていません</p>
          )}
        </div>
      </Card>

      {/* MoneyForward連携 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 size={16} style={{ color: 'var(--accent)' }} />
            <CardTitle>MoneyForward 連携</CardTitle>
          </div>
          <div className="flex gap-2">
            <button onClick={handleMfCheck} disabled={mfChecking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              <RefreshCw size={12} className={mfChecking ? 'animate-spin' : ''} />
              {mfChecking ? '確認中...' : '接続確認'}
            </button>
            {mfStatus?.connected && (
              <button onClick={handleMfSync} disabled={mfSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                <RefreshCw size={12} className={mfSyncing ? 'animate-spin' : ''} />
                {mfSyncing ? '同期中...' : '入金データ同期'}
              </button>
            )}
          </div>
        </CardHeader>

        {mfStatus && (
          <div className="mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ background: mfStatus.connected ? '#F0FDF4' : '#FEF2F2' }}>
            {mfStatus.connected
              ? <><CheckCircle size={13} color="#16A34A" /><span style={{ color: '#16A34A' }}>接続成功 — {mfStatus.accountCount}件の口座が連携中</span></>
              : <><XCircle size={13} color="#EF4444" /><span style={{ color: '#EF4444' }}>接続失敗: {mfStatus.error}</span></>
            }
          </div>
        )}

        {mfSyncResult && (
          <div className="mb-3 text-xs px-3 py-2 rounded-lg"
            style={{ background: mfSyncResult.startsWith('✓') ? '#F0FDF4' : '#FEF2F2',
              color: mfSyncResult.startsWith('✓') ? '#16A34A' : '#EF4444' }}>
            {mfSyncResult}
          </div>
        )}

        {mfAccounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>連携口座</p>
            {mfAccounts.map((acc: any) => (
              <div key={acc.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-medium">{acc.service?.name ?? acc.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {acc.last_succeeded_at ? `最終更新: ${acc.last_succeeded_at.slice(0, 10)}` : '未取得'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">
                    ¥{(acc.balance ?? acc.asset ?? 0).toLocaleString()}
                  </p>
                  {acc.error_msg && (
                    <p className="text-xs" style={{ color: '#EF4444' }}>{acc.error_msg}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!mfStatus && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>
            「接続確認」ボタンで MoneyForward との連携状態を確認できます
          </p>
        )}
      </Card>

      {/* データエクスポート */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color: 'var(--accent)' }} />
            <CardTitle>データエクスポート</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-2">
          {[
            { key: 'projects', label: 'プロジェクト一覧', desc: '全プロジェクトをExcelでダウンロード' },
            { key: 'payments', label: '入金記録', desc: '全入金記録をExcelでダウンロード' },
            { key: 'contractors', label: '業務委託案件', desc: '全委託案件をExcelでダウンロード' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.desc}</p>
              </div>
              <button onClick={() => handleExport(item.key as any)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-white transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                <Download size={12} />ダウンロード
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* ロール説明 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={16} style={{ color: 'var(--accent)' }} />
            <CardTitle>権限ロール一覧</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-2">
          {(Object.keys(roleLabels) as UserRole[]).map(role => (
            <div key={role} className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--accent-light)' }}>
                <User size={13} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-sm font-medium">{roleLabels[role]}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{roleDescriptions[role]}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
