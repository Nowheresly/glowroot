import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface SideListItem {
  label: string
  href: string
  /** Additional text shown on the right side (e.g. count) */
  rightText?: string
  /** Custom active state check — if omitted, checks pathname match */
  active?: boolean
  /** Hide this item */
  hidden?: boolean
}

export interface SideListGroup {
  items: SideListItem[]
}

interface SideListProps {
  groups: SideListGroup[]
  header?: ReactNode
  className?: string
}

export function SideList({ groups, header, className }: SideListProps) {
  const location = useLocation()

  return (
    <div className={cn('w-52 shrink-0', className)}>
      {groups.map((group, gi) => (
        <div
          key={gi}
          className="mb-4 overflow-hidden rounded-lg border border-[var(--gr-border)] bg-[var(--gr-surface)]"
        >
          {gi === 0 && header}
          <div className="flex flex-col">
            {group.items
              .filter((item) => !item.hidden)
              .map((item) => {
                const active =
                  item.active !== undefined
                    ? item.active
                    : location.pathname === item.href ||
                      location.pathname + location.search === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center justify-between border-b border-[var(--gr-border)] px-3 py-2 text-sm no-underline last:border-b-0 transition-colors',
                      active
                        ? 'border-l-[3px] border-l-[var(--gr-accent)] bg-[var(--gr-accent-muted)] pl-[9px] font-medium text-[var(--gr-accent)]'
                        : 'border-l-[3px] border-l-transparent text-[var(--gr-text)] hover:bg-[var(--gr-surface-2)]'
                    )}
                  >
                    <span className="break-all">{item.label}</span>
                    {item.rightText && (
                      <span className="ml-3 whitespace-nowrap text-xs text-[var(--gr-muted)]">
                        {item.rightText}
                      </span>
                    )}
                  </Link>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
