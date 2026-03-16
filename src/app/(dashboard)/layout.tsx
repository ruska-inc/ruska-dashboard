import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <Header />
      <main className="pt-14 min-h-screen" style={{ marginLeft: '240px' }}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
