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
        <div key={gi} className="mb-4 rounded-md border bg-white">
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
                      'flex items-center justify-between px-3 py-2 text-sm no-underline',
                      'border-b last:border-b-0 transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span className="break-all">{item.label}</span>
                    {item.rightText && (
                      <span className="ml-3 whitespace-nowrap text-xs text-gray-500">
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
