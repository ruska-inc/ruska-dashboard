'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  Users,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'ダッシュボード',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'プロジェクト管理',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    label: '売上・入金管理',
    href: '/sales',
    icon: Wallet,
  },
  {
    label: '業務委託管理',
    href: '/contractors',
    icon: Users,
  },
  {
    label: '設定',
    href: '/settings',
    icon: Settings,
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col" style={{ background: 'var(--sidebar)' }}>
      {/* ロゴ */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--accent)' }}>
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Ruska inc.</p>
          <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>管理ダッシュボード</p>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
              style={isActive ? { background: 'var(--accent)', color: 'white' } : {}}
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* フッター */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>
            管
          </div>
          <div>
            <p className="text-white text-sm font-medium">管理者</p>
            <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>admin</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
