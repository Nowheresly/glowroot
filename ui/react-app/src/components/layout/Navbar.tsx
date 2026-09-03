import { Link, useLocation } from 'react-router-dom'
import {
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useLayout } from '../../contexts/LayoutContext'
import { useAgent } from '../../contexts/AgentContext'
import { useAuth } from '../../contexts/AuthContext'
import { AgentSelector } from './AgentSelector'
import { cn } from '../../lib/utils'

function classicPath(modernPath: string): string {
  return modernPath.replace(/^\/modern/, '') || '/'
}

export function Navbar() {
  const { layout } = useLayout()
  const { agentQueryString } = useAgent()
  const { loggedIn, loginEnabled, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const qs = agentQueryString()
  const currentSection = location.pathname.split('/')[2]

  function navItem(
    label: string,
    section: string,
    path: string,
    show: boolean
  ) {
    if (!show) return null
    const href = '/modern/' + path + qs
    const active =
      currentSection === section ||
      (section === 'syntheticMonitor' && currentSection === 'synthetic-monitors')
    return (
      <Link
        key={section}
        to={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center px-3 py-2 text-sm font-medium transition-colors',
          'hover:text-white',
          active
            ? 'text-white border-b-2 border-[var(--gr-accent-bright)]'
            : 'text-white/70 border-b-2 border-transparent'
        )}
      >
        {label}
      </Link>
    )
  }

  const showGears =
    layout.showNavbarConfig ||
    layout.adminView ||
    (!loggedIn && loginEnabled) ||
    (loggedIn && !layout.ldap)

  return (
    <nav className="bg-[var(--gr-nav)] text-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-12 items-center justify-between">
          <Link
            to="/modern/"
            className="mr-5 text-lg font-semibold tracking-tight text-white no-underline"
          >
            Glowroot
            <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-[var(--gr-accent-bright)]">
              modern
            </span>
          </Link>

          {layout.central && <AgentSelector />}

          <div className="hidden md:flex flex-1 items-center gap-0.5">
            {navItem('Transactions', 'transaction', 'transaction/average', layout.showNavbarTransaction)}
            {navItem('Errors', 'error', 'error/messages', layout.showNavbarError)}
            {navItem('JVM', 'jvm', 'jvm/gauges', layout.showNavbarJvm)}
            {layout.central && navItem('Synthetic', 'syntheticMonitor', 'synthetic-monitors', layout.showNavbarSyntheticMonitor)}
            {navItem('Incidents', 'incidents', 'incidents', layout.showNavbarIncident)}
            {navItem('Reporting', 'report', 'report/ad-hoc', layout.showNavbarReport)}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <a
              href={classicPath(location.pathname + location.search)}
              className="rounded border border-white/20 px-2.5 py-1 text-xs text-white/80 hover:border-white/40 hover:text-white transition-colors"
              target="_self"
            >
              Classic UI
            </a>

            {showGears && (
              <div className="relative group">
                <button
                  className="p-2 text-white/70 hover:text-white"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <div className="absolute right-0 top-full z-50 hidden group-hover:block w-48 rounded-md border border-[var(--gr-border)] bg-white py-1 text-gray-800 shadow-lg">
                  {layout.showNavbarConfig && (
                    <Link
                      to={'/modern/config/general' + qs}
                      className="block px-4 py-1.5 text-sm text-gray-800 no-underline hover:bg-gray-50"
                    >
                      Configuration
                    </Link>
                  )}
                  {layout.adminView && (
                    <Link
                      to="/modern/admin/general"
                      className="block px-4 py-1.5 text-sm text-gray-800 no-underline hover:bg-gray-50"
                    >
                      Administration
                    </Link>
                  )}
                  {!loggedIn && loginEnabled && (
                    <Link
                      to="/modern/login"
                      className="block px-4 py-1.5 text-sm text-gray-800 no-underline hover:bg-gray-50"
                    >
                      Login
                    </Link>
                  )}
                  {loggedIn && !layout.ldap && (
                    <Link
                      to="/modern/profile/change-password"
                      className="block px-4 py-1.5 text-sm text-gray-800 no-underline hover:bg-gray-50"
                    >
                      Change my password
                    </Link>
                  )}
                </div>
              </div>
            )}

            {loggedIn && (
              <button
                onClick={signOut}
                className="p-2 text-white/70 hover:text-white"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>

          <button
            className="md:hidden p-2 text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/15 pb-3">
            <div className="flex flex-col pt-2">
              {navItem('Transactions', 'transaction', 'transaction/average', layout.showNavbarTransaction)}
              {navItem('Errors', 'error', 'error/messages', layout.showNavbarError)}
              {navItem('JVM', 'jvm', 'jvm/gauges', layout.showNavbarJvm)}
              {layout.central && navItem('Synthetic', 'syntheticMonitor', 'synthetic-monitors', layout.showNavbarSyntheticMonitor)}
              {navItem('Incidents', 'incidents', 'incidents', layout.showNavbarIncident)}
              {navItem('Reporting', 'report', 'report/ad-hoc', layout.showNavbarReport)}
              <a
                href={classicPath(location.pathname + location.search)}
                className="px-3 py-2 text-sm text-white/60 hover:text-white"
                target="_self"
              >
                Classic UI
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
