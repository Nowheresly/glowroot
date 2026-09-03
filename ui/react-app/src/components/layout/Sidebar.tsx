import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

export interface SidebarItem {
  label: string
  href: string
  /** Additional text shown on the right side (e.g. count) */
  rightText?: string
  /** Custom active state check — if omitted, checks pathname match */
  active?: boolean
  /** Hide this item */
  hidden?: boolean
}

export interface SidebarGroup {
  items: SidebarItem[]
}

interface SidebarProps {
  groups: SidebarGroup[]
}

export function Sidebar({ groups }: SidebarProps) {
  const location = useLocation()

  return (
    <div className="w-52 shrink-0">
      {groups.map((group, gi) => (
        <div
          key={gi}
          className="mb-4 overflow-hidden rounded-lg border border-[var(--gr-border)] bg-[var(--gr-surface)]"
        >
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
                        ? 'border-l-[3px] border-l-[var(--gr-accent)] bg-emerald-50/80 pl-[9px] font-medium text-[var(--gr-accent)]'
                        : 'border-l-[3px] border-l-transparent text-gray-700 hover:bg-gray-50'
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
