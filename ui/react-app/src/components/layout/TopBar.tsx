import { useLocation } from 'react-router-dom'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useLayout } from '../../contexts/LayoutContext'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useRangeSlot } from '../../contexts/RangeSlotContext'
import { AgentSelector } from './AgentSelector'
import { ChartRangeSelector } from '../chart/ChartRangeSelector'

function classicPath(modernPath: string): string {
  return modernPath.replace(/^\/modern/, '') || '/'
}

function sectionTitle(pathname: string): string {
  const section = pathname.split('/')[2] ?? ''
  switch (section) {
    case 'transaction':
      return 'Transactions'
    case 'error':
      return 'Errors'
    case 'jvm':
      return 'JVM'
    case 'config':
      return 'Configuration'
    case 'admin':
      return 'Administration'
    case 'synthetic-monitors':
      return 'Synthetic'
    case 'incidents':
      return 'Incidents'
    case 'report':
      return 'Reporting'
    case 'login':
      return 'Login'
    case 'profile':
      return 'Profile'
    default:
      return 'Glowroot'
  }
}

export function TopBar() {
  const { layout } = useLayout()
  const { loggedIn, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const rangeSlot = useRangeSlot()
  const location = useLocation()

  return (
    <header
      className={`flex shrink-0 items-center gap-3 border-b border-[var(--gr-border)] bg-[var(--gr-surface)] px-4 ${
        rangeSlot ? 'min-h-12 py-2' : 'h-12'
      }`}
    >
      <strong className="shrink-0 self-start pt-1.5 text-sm font-semibold text-[var(--gr-text)]">
        {sectionTitle(location.pathname)}
      </strong>

      {layout.central && (
        <div className="self-start pt-0.5">
          <AgentSelector />
        </div>
      )}

      <div className="min-w-0 flex-1 overflow-x-auto">
        {rangeSlot && (
          <ChartRangeSelector range={rangeSlot.range} actions={rangeSlot.actions} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={classicPath(location.pathname + location.search)}
          className="rounded border border-[var(--gr-border)] px-2.5 py-1 text-xs text-[var(--gr-muted)] no-underline transition-colors hover:border-[var(--gr-accent)] hover:text-[var(--gr-text)]"
          target="_self"
        >
          Classic UI
        </a>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded p-2 text-[var(--gr-muted)] hover:bg-[var(--gr-surface-2)] hover:text-[var(--gr-text)]"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {loggedIn && (
          <button
            type="button"
            onClick={signOut}
            className="rounded p-2 text-[var(--gr-muted)] hover:bg-[var(--gr-surface-2)] hover:text-[var(--gr-text)]"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  )
}
