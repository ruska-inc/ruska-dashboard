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
      className="fixed top-0 right-0 h-14 flex items-center justify-between px-6 z-10"
      style={{
        left: '240px',
        background: 'rgba(255, 255, 255, 0.60)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.65)',
        boxShadow: '0 1px 0 rgba(99,102,241,0.08), 0 4px 16px rgba(99,102,241,0.06)',
      }}
    >
      <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        {title}
      </h1>
      <div className="flex items-center gap-2">
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-black/6"
          style={{ color: 'var(--muted)' }}
        >
          <Bell size={15} />
        </button>
      </div>
    </header>
  )
}
