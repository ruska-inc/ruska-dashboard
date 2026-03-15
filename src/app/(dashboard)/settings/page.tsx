'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { UserRole } from '@/lib/types'
import { Shield, User, Plus } from 'lucide-react'

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

const mockUsers = [
  { id: '1', name: '中川 達貴', email: 's.nakajima@ruska.co.jp', role: 'admin' as UserRole },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* ユーザー管理 */}
      <Card>
        <CardHeader>
          <CardTitle>ユーザー管理</CardTitle>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--primary)' }}
          >
            <Plus size={13} />
            ユーザー追加
          </button>
        </CardHeader>
        <div className="space-y-2">
          {mockUsers.map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{user.email}</p>
                </div>
              </div>
              <span
                className="text-xs px-2 py-1 rounded-md font-medium"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                {roleLabels[user.role]}
              </span>
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
            <div
              key={role}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: '#FAFAFA', border: '1px solid var(--border)' }}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--accent-light)' }}
              >
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
