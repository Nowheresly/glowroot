import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface SectionTab {
  id: string
  label: ReactNode
  href: string
  active: boolean
}

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  return (
    <nav className="mb-4 flex border-b border-[var(--gr-border)]">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.href}
          className={cn(
            'border-b-2 -mb-px px-4 py-2 text-sm no-underline transition-colors',
            tab.active
              ? 'border-[var(--gr-accent)] font-medium text-[var(--gr-accent)]'
              : 'border-transparent text-[var(--gr-muted)] hover:text-[var(--gr-text)]'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
