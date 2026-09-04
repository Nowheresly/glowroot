import { Outlet, useLocation } from 'react-router-dom'
import { SideList, type SideListGroup } from '../../components/layout/SideList'
import { PageHeader } from '../../components/layout/PageHeader'
import { useLayout } from '../../contexts/LayoutContext'

export function AdminLayout() {
  const { layout } = useLayout()
  const location = useLocation()
  const path = location.pathname

  document.title = 'Administration \u00b7 Glowroot'

  const groups: SideListGroup[] = [
    {
      items: [
        { label: 'General', href: '/modern/admin/general' },
        {
          label: 'Users',
          href: '/modern/admin/user-list',
          active: path === '/modern/admin/user-list' || path === '/modern/admin/user',
        },
        {
          label: 'Roles',
          href: '/modern/admin/role-list',
          active: path === '/modern/admin/role-list' || path === '/modern/admin/role',
        },
        { label: 'Web', href: '/modern/admin/web' },
        { label: 'Storage', href: '/modern/admin/storage' },
        { label: 'SMTP', href: '/modern/admin/smtp' },
        { label: 'HTTP proxy', href: '/modern/admin/http-proxy' },
        {
          label: 'Integrations',
          href: '/modern/admin/integration-list',
          active:
            path === '/modern/admin/integration-list' ||
            path.startsWith('/modern/admin/integration/'),
        },
      ],
    },
    {
      items: [
        { label: 'admin.json', href: '/modern/admin/json' },
      ],
    },
  ]

  const title = layout.embeddedAgentRollup?.lastDisplayPart ? (
    <>
      {layout.embeddedAgentRollup.lastDisplayPart}
      <span className="mx-2 text-[var(--gr-muted)]">|</span>
      Administration
    </>
  ) : (
    'Administration'
  )

  return (
    <div>
      <PageHeader title={title} />
      <div className="flex gap-6">
        <SideList groups={groups} />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
