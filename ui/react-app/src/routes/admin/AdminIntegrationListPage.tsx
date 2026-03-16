import { Link } from 'react-router-dom'

export function AdminIntegrationListPage() {
  const items = [
    { label: 'LDAP', href: '/modern/admin/integration/ldap' },
    { label: 'PagerDuty', href: '/modern/admin/integration/pager-duty' },
    { label: 'Slack', href: '/modern/admin/integration/slack' },
    { label: 'Healthchecks.io', href: '/modern/admin/integration/healthchecks-io' },
  ]

  return (
    <div className="rounded-lg border bg-white">
      {items.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b last:border-b-0 no-underline"
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
