import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar, type SidebarGroup } from '../../components/layout/Sidebar'
import { useLayout } from '../../contexts/LayoutContext'
import { useAgent } from '../../contexts/AgentContext'

export function ConfigLayout() {
  const { layout } = useLayout()
  const { agentRollup, agentRollupId, isRollup, agentQueryString } = useAgent()
  const location = useLocation()
  const path = location.pathname

  document.title = 'Configuration · Glowroot'

  // In central mode, an agent must be selected before any config page works
  const needsAgent = layout.central && !agentRollupId

  const qs = agentQueryString()

  const groups: SidebarGroup[] = [
    {
      items: [
        {
          label: 'General',
          href: '/modern/config/general' + qs,
          hidden: !layout.central,
        },
        {
          label: 'Transactions',
          href: '/modern/config/transaction' + qs,
          hidden: isRollup,
        },
        {
          label: 'Gauges',
          href: '/modern/config/gauge-list' + qs,
          active: path === '/modern/config/gauge-list' || path === '/modern/config/gauge',
          hidden: isRollup,
        },
        {
          label: 'JVM',
          href: '/modern/config/jvm' + qs,
          hidden: isRollup,
        },
        {
          label: 'Synthetic monitors',
          href: '/modern/config/synthetic-monitor-list' + qs,
          active: path === '/modern/config/synthetic-monitor-list' || path === '/modern/config/synthetic-monitor',
          hidden: !layout.central,
        },
        {
          label: 'Alerts',
          href: '/modern/config/alert-list' + qs,
          active: path === '/modern/config/alert-list' || path === '/modern/config/alert',
        },
        {
          label: 'UI defaults',
          href: '/modern/config/ui-defaults' + qs,
        },
        {
          label: 'Plugins',
          href: '/modern/config/plugin-list' + qs,
          active: path === '/modern/config/plugin-list' || path === '/modern/config/plugin',
          hidden: isRollup,
        },
        {
          label: 'Instrumentation',
          href: '/modern/config/instrumentation-list' + qs,
          active: path === '/modern/config/instrumentation-list' || path === '/modern/config/instrumentation',
          hidden: isRollup,
        },
        {
          label: 'Advanced',
          href: '/modern/config/advanced' + qs,
        },
      ],
    },
    {
      items: [
        {
          label: 'config.json',
          href: '/modern/config/json' + qs,
          hidden: isRollup,
        },
      ],
    },
  ]

  const displayName = agentRollup?.lastDisplayPart || ''

  return (
    <div>
      <div className="mb-4">
        {displayName ? (
          <h1 className="text-xl font-semibold text-gray-900">
            {displayName}
            <span className="mx-2 text-gray-400">|</span>
            Configuration
          </h1>
        ) : (
          <h1 className="text-xl font-semibold text-gray-900">Configuration</h1>
        )}
      </div>
      <div className="flex gap-6">
        {!needsAgent && <Sidebar groups={groups} />}
        <div className="flex-1 min-w-0">
          {needsAgent ? (
            <p className="text-sm text-gray-500">Please select an agent from the dropdown above.</p>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  )
}
