import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function PageHeader({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-3', className)}>
      <div className="text-lg font-semibold text-[var(--gr-text)]">{title}</div>
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
