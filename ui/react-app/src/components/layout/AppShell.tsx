import { Outlet } from 'react-router-dom'
import { NavRail } from './NavRail'
import { TopBar } from './TopBar'
import { Footer } from './Footer'

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-[var(--gr-bg)]">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 py-4 md:px-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
