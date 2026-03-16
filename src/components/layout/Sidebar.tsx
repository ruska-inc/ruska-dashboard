'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  Users,
  Settings,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getMyProfile } from '@/lib/supabase/queries'
import { useEffect, useState } from 'react'

const navItems = [
  { label: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { label: 'プロジェクト管理', href: '/projects', icon: FolderKanban },
  { label: '売上・入金管理', href: '/sales', icon: Wallet },
  { label: '業務委託管理', href: '/contractors', icon: Users },
  { label: '設定', href: '/settings', icon: Settings },
]

const roleLabels: Record<string, string> = {
  admin: '管理者',
  management: '経営管理',
  accounting: '経理メンバー',
  internal: '社内メンバー',
  contractor: '業務委託',
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<{ name: string; email: string; role: string } | null>(null)

  useEffect(() => {
    getMyProfile().then(p => {
      if (p) setProfile({ name: p.name, email: p.email, role: p.role })
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.name ? profile.name.slice(0, 1) : '?'

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 flex flex-col"
      style={{
        background: 'var(--sidebar)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        borderRight: '1px solid var(--sidebar-border)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.18)',
      }}
    >
      {/* ロゴ */}
      <div className="flex items-center gap-2 px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #7A9E7E, #5a8060)',
            boxShadow: '0 2px 8px rgba(122,158,126,0.5)',
          }}
        >
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Ruska inc.</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>管理ダッシュボード</p>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive ? 'text-white' : 'text-gray-400 hover:text-white'
              )}
              style={isActive ? {
                background: 'rgba(122, 158, 126, 0.28)',
                backdropFilter: 'blur(12px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
                color: 'white',
              } : {
                background: 'transparent',
              }}
            >
              <Icon size={17} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={13} className="opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* フッター */}
      <div className="px-4 py-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{
              background: 'linear-gradient(135deg, #7A9E7E, #5a8060)',
              boxShadow: '0 2px 6px rgba(122,158,126,0.4)',
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {profile?.name ?? '読み込み中...'}
            </p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {profile ? roleLabels[profile.role] ?? profile.role : ''}
            </p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/8"
          style={{ color: 'rgba(255,255,255,0.45)' }}>
          <LogOut size={14} />
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  )
}
