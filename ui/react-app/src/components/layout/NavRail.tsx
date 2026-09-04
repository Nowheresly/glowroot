import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Cpu,
  FileBarChart,
  LogIn,
  Radar,
  Settings,
  Shield,
  Siren,
} from 'lucide-react'
import { useLayout } from '../../contexts/LayoutContext'
import { useAgent } from '../../contexts/AgentContext'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

interface RailItem {
  id: string
  label: string
  href: string
  icon: typeof Activity
  show: boolean
  match: (section: string) => boolean
}

export function NavRail() {
  const { layout } = useLayout()
  const { agentQueryString } = useAgent()
  const { loggedIn, loginEnabled } = useAuth()
  const location = useLocation()
  const qs = agentQueryString()
  const section = location.pathname.split('/')[2] ?? ''

  const items: RailItem[] = [
    {
      id: 'transaction',
      label: 'Transactions',
      href: '/modern/transaction/average' + qs,
      icon: Activity,
      show: layout.showNavbarTransaction,
      match: (s) => s === 'transaction',
    },
    {
      id: 'error',
      label: 'Errors',
      href: '/modern/error/messages' + qs,
      icon: AlertTriangle,
      show: layout.showNavbarError,
      match: (s) => s === 'error',
    },
    {
      id: 'jvm',
      label: 'JVM',
      href: '/modern/jvm/gauges' + qs,
      icon: Cpu,
      show: layout.showNavbarJvm,
      match: (s) => s === 'jvm',
    },
    {
      id: 'syntheticMonitor',
      label: 'Synthetic',
      href: '/modern/synthetic-monitors' + qs,
      icon: Radar,
      show: !!(layout.central && layout.showNavbarSyntheticMonitor),
      match: (s) => s === 'synthetic-monitors' || s === 'syntheticMonitor',
    },
    {
      id: 'incidents',
      label: 'Incidents',
      href: '/modern/incidents' + qs,
      icon: Siren,
      show: layout.showNavbarIncident,
      match: (s) => s === 'incidents',
    },
    {
      id: 'report',
      label: 'Reporting',
      href: '/modern/report/ad-hoc' + qs,
      icon: FileBarChart,
      show: layout.showNavbarReport,
      match: (s) => s === 'report',
    },
  ]

  const showConfig = layout.showNavbarConfig
  const showAdmin = layout.adminView
  const showLogin = !loggedIn && loginEnabled
  const showPassword = loggedIn && !layout.ldap
  const showBottom = showConfig || showAdmin || showLogin || showPassword

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center bg-[var(--gr-rail)] py-3 text-[var(--gr-rail-fg)]">
      <Link
        to={'/modern/' + qs}
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gr-accent)] text-xs font-bold text-white no-underline"
        title="Glowroot"
      >
        G
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {items
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon
            const active = item.match(section)
            return (
              <Link
                key={item.id}
                to={item.href}
                title={item.label}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                  active
                    ? 'bg-[var(--gr-accent)]/20 text-[var(--gr-accent-bright)]'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5" />
              </Link>
            )
          })}
      </nav>

      {showBottom && (
        <div className="relative mt-2 group">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          <div className="absolute bottom-0 left-full z-50 ml-2 hidden w-48 rounded-md border border-[var(--gr-border)] bg-[var(--gr-surface)] py-1 text-[var(--gr-text)] shadow-lg group-hover:block">
            {showConfig && (
              <Link
                to={'/modern/config/general' + qs}
                className="block px-4 py-1.5 text-sm no-underline hover:bg-[var(--gr-surface-2)]"
              >
                Configuration
              </Link>
            )}
            {showAdmin && (
              <Link
                to="/modern/admin/general"
                className="flex items-center gap-2 px-4 py-1.5 text-sm no-underline hover:bg-[var(--gr-surface-2)]"
              >
                <Shield className="h-3.5 w-3.5" />
                Administration
              </Link>
            )}
            {showLogin && (
              <Link
                to="/modern/login"
                className="flex items-center gap-2 px-4 py-1.5 text-sm no-underline hover:bg-[var(--gr-surface-2)]"
              >
                <LogIn className="h-3.5 w-3.5" />
                Login
              </Link>
            )}
            {showPassword && (
              <Link
                to="/modern/profile/change-password"
                className="block px-4 py-1.5 text-sm no-underline hover:bg-[var(--gr-surface-2)]"
              >
                Change my password
              </Link>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
