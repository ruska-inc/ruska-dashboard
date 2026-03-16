'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { UserRole, PeriodSetting, Client } from '@/lib/types'
import { Shield, User, Plus, Download, Mail, Trash2, CalendarDays, Building2, Pencil } from 'lucide-react'
import { getAllProfiles, updateProfileRole, getPeriods, createPeriod, deletePeriod, getClients, createClientRecord, updateClientRecord, deleteClientRecord } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'

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

  const [clients, setClients] = useState<Client[]>([])
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editClientName, setEditClientName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('internal')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [showInviteForm, setShowInviteForm] = useState(false)

  useEffect(() => {
    getAllProfiles().then(setProfiles).catch(() => {})
    getPeriods().then(setPeriods).catch(() => {})
    getClients().then(setClients).catch(() => {})
  }, [])

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName.trim()) return
    setAddingClient(true)
    try {
      const created = await createClientRecord(newClientName.trim())
      setClients(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewClientName('')
    } finally {
      setAddingClient(false)
    }
  }

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient || !editClientName.trim()) return
    const updated = await updateClientRecord(editingClient.id, editClientName.trim())
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)))
    setEditingClient(null)
  }

  const handleDeleteClient = async (id: string) => {
    await deleteClientRecord(id)
    setClients(prev => prev.filter(c => c.id !== id))
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

      {/* 顧客マスタ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 size={16} style={{ color: 'var(--accent)' }} />
            <CardTitle>顧客マスタ</CardTitle>
          </div>
        </CardHeader>

        <form onSubmit={handleAddClient} className="flex gap-2 mb-4">
          <input
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            placeholder="例: 株式会社○○"
            className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <button type="submit" disabled={addingClient || !newClientName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}>
            <Plus size={13} />追加
          </button>
        </form>

        <div className="space-y-2">
          {clients.map(client => (
            <div key={client.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}>
              {editingClient?.id === client.id ? (
                <form onSubmit={handleUpdateClient} className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus
                    value={editClientName}
                    onChange={e => setEditClientName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm rounded border outline-none focus:ring-2"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                  <button type="submit" className="px-2 py-1 text-xs rounded font-medium text-white"
                    style={{ background: 'var(--primary)' }}>保存</button>
                  <button type="button" onClick={() => setEditingClient(null)}
                    className="px-2 py-1 text-xs rounded border"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>取消</button>
                </form>
              ) : (
                <>
                  <span className="text-sm font-medium">{client.name}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingClient(client); setEditClientName(client.name) }}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100"
                      style={{ color: 'var(--muted)' }}><Pencil size={13} /></button>
                    <button onClick={() => handleDeleteClient(client.id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"
                      style={{ color: '#EF4444' }}><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
          {clients.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>顧客が登録されていません</p>
          )}
        </div>
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
