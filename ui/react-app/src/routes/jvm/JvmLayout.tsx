import { Outlet, useLocation } from 'react-router-dom'
import { SideList, type SideListGroup } from '../../components/layout/SideList'
import { PageHeader } from '../../components/layout/PageHeader'
import { useLayout } from '../../contexts/LayoutContext'
import { useAgent } from '../../contexts/AgentContext'

export function JvmLayout() {
  const { layout } = useLayout()
  const { agentRollup, agentRollupId, isRollup, agentQueryString } = useAgent()
  const location = useLocation()
  const path = location.pathname

  document.title = 'JVM · Glowroot'

  const needsAgent = layout.central && !agentRollupId
  const qs = agentQueryString()
  const perms = agentRollup?.permissions?.jvm

  const groups: SideListGroup[] = [
    {
      items: [
        {
          label: 'Gauges',
          href: '/modern/jvm/gauges' + qs,
          hidden: !(perms?.gauges ?? true),
        },
        {
          label: 'Thread dump',
          href: '/modern/jvm/thread-dump' + qs,
          active: path === '/modern/jvm/thread-dump' || path === '/modern/jvm/jstack',
          hidden: !(perms?.threadDump) || isRollup || layout.offlineViewer,
        },
        {
          label: 'Heap dump',
          href: '/modern/jvm/heap-dump' + qs,
          hidden: !(perms?.heapDump) || isRollup || layout.offlineViewer,
        },
        {
          label: 'Heap histogram',
          href: '/modern/jvm/heap-histogram' + qs,
          hidden: !(perms?.heapHistogram) || isRollup || layout.offlineViewer,
        },
        {
          label: 'Force GC',
          href: '/modern/jvm/force-gc' + qs,
          hidden: !(perms?.forceGC) || isRollup || layout.offlineViewer,
        },
        {
          label: 'MBean tree',
          href: '/modern/jvm/mbean-tree' + qs,
          hidden: !(perms?.mbeanTree) || isRollup || layout.offlineViewer,
        },
        {
          label: 'System properties',
          href: '/modern/jvm/system-properties' + qs,
          hidden: !(perms?.systemProperties) || isRollup || layout.offlineViewer,
        },
        {
          label: 'Environment',
          href: '/modern/jvm/environment' + qs,
          hidden: !(perms?.environment) || isRollup,
        },
        {
          label: 'Capabilities',
          href: '/modern/jvm/capabilities' + qs,
          hidden: !(perms?.capabilities) || isRollup || layout.offlineViewer,
        },
      ],
    },
  ]

  const displayName = agentRollup?.lastDisplayPart || ''
  const title = displayName ? (
    <>
      {displayName}
      <span className="mx-2 text-[var(--gr-muted)]">|</span>
      JVM
    </>
  ) : (
    'JVM'
  )

  return (
    <div>
      <PageHeader title={title} />
      <div className="flex gap-6">
        {!needsAgent && <SideList groups={groups} />}
        <div className="min-w-0 flex-1">
          {needsAgent ? (
            <p className="text-sm text-[var(--gr-muted)]">
              Please select an agent from the dropdown above.
            </p>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  )
}
