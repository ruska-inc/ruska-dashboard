'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/dashboard': 'ダッシュボード',
  '/projects': 'プロジェクト管理',
  '/sales': '売上・入金管理',
  '/contractors': '業務委託管理',
  '/settings': '設定',
}

export default function Header() {
  const pathname = usePathname()
  const title = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'ダッシュボード'

  return (
    <header
      className="fixed top-0 right-0 h-14 flex items-center justify-between px-6 border-b z-10"
      style={{ left: '240px', background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
          style={{ color: 'var(--muted)' }}
        >
          <Bell size={16} />
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          管
        </div>
      </div>
    </header>
  )
}
