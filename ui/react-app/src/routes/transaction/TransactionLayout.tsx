/*
 * TransactionLayout — shared layout for transaction and error pages.
 *
 * Provides: header with transaction type dropdown, sidebar with summaries,
 * tab bar, and child page outlet.
 */

import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import {
  useTransaction,
  TRANSACTION_SORT_ORDERS,
  ERROR_SORT_ORDERS,
} from '../../contexts/TransactionContext'
import { useAgent } from '../../contexts/AgentContext'
import { useLayout } from '../../contexts/LayoutContext'
import { useRegisterRangeSlot } from '../../contexts/RangeSlotContext'
import { PageHeader } from '../../components/layout/PageHeader'
import { SideList, type SideListItem } from '../../components/layout/SideList'
import { SectionTabs, type SectionTab } from '../../components/layout/SectionTabs'

export function TransactionLayout() {
  const { layout } = useLayout()
  const { agentRollup, agentRollupId } = useAgent()
  const txn = useTransaction()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  useRegisterRangeSlot(txn.range, txn.rangeActions)

  const needsAgent = layout.central && !agentRollupId

  document.title = `${txn.headerDisplay} · Glowroot`

  const displayName = agentRollup?.lastDisplayPart || ''

  const isTransaction = txn.shortName === 'transaction'
  const sortOrders = isTransaction ? TRANSACTION_SORT_ORDERS : ERROR_SORT_ORDERS

  const transactionTypes = agentRollup?.transactionTypes ?? []
  const showTypeDropdown = transactionTypes.length > 1

  function sidebarQs(transactionName: string | null) {
    const params = new URLSearchParams(searchParams)
    if (transactionName) {
      params.set('transaction-name', transactionName)
    } else {
      params.delete('transaction-name')
    }
    const qs = params.toString()
    return qs ? '?' + qs : ''
  }

  const basePath = `/modern/${txn.shortName}`
  const pathAfterBase = location.pathname.replace(basePath + '/', '')

  const summaryItems: SideListItem[] = []
  if (txn.transactionSummaries.length > 0 || txn.overallSummary) {
    summaryItems.push({
      label: `All ${txn.transactionType}`,
      href: `${location.pathname}${sidebarQs(null)}`,
      active: !txn.transactionName,
      rightText: txn.overallSummary
        ? txn.summaryValueFn(txn.overallSummary)
        : undefined,
    })
    for (const s of txn.transactionSummaries) {
      summaryItems.push({
        label: s.transactionName,
        href: `${location.pathname}${sidebarQs(s.transactionName)}`,
        active: txn.transactionName === s.transactionName,
        rightText: txn.summaryValueFn(s),
      })
    }
  }

  const tabs: SectionTab[] = isTransaction
    ? buildTransactionTabs(
        basePath,
        txn.buildTabQueryString(),
        pathAfterBase,
        agentRollup?.permissions?.transaction,
        txn.traceCount,
        txn.transactionType
      )
    : buildErrorTabs(
        basePath,
        txn.buildTabQueryString(),
        pathAfterBase,
        agentRollup?.permissions?.error
      )

  const title = displayName ? (
    <>
      {displayName}
      <span className="mx-2 text-[var(--gr-muted)]">|</span>
      {txn.headerDisplay}
    </>
  ) : (
    txn.headerDisplay
  )

  return (
    <div>
      <PageHeader title={title}>
        {showTypeDropdown && (
          <select
            className="rounded border border-[var(--gr-border)] bg-[var(--gr-surface)] px-2 py-1 text-sm text-[var(--gr-text)]"
            value={txn.transactionType}
            onChange={(e) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                next.set('transaction-type', e.target.value)
                next.delete('transaction-name')
                return next
              })
            }}
          >
            {transactionTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </PageHeader>

      {needsAgent ? (
        <p className="text-sm text-[var(--gr-muted)]">
          Please select an agent from the dropdown above.
        </p>
      ) : !txn.transactionType ? (
        <p className="text-sm text-[var(--gr-muted)]">No transaction types available.</p>
      ) : (
        <div className="flex gap-6">
          <div className="print:hidden">
            {txn.summaryLoading && summaryItems.length === 0 ? (
              <div className="flex h-24 w-52 items-center justify-center rounded-lg border border-[var(--gr-border)] bg-[var(--gr-surface)] text-sm text-[var(--gr-muted)]">
                Loading...
              </div>
            ) : summaryItems.length === 0 ? (
              <div className="flex h-24 w-52 items-center justify-center rounded-lg border border-[var(--gr-border)] bg-[var(--gr-surface)] text-sm font-medium text-[var(--gr-muted)]">
                No data for this time period
              </div>
            ) : (
              <>
                <SideList
                  header={
                    <div className="border-b border-[var(--gr-border)] bg-[var(--gr-surface-2)]">
                      <select
                        className="w-full border-0 bg-transparent px-3 py-2 text-sm text-[var(--gr-text)]"
                        value={txn.summarySortOrder}
                        onChange={(e) => txn.setSummarySortOrder(e.target.value)}
                      >
                        {Object.entries(sortOrders).map(([value, display]) => (
                          <option key={value} value={value}>
                            {display}
                          </option>
                        ))}
                      </select>
                    </div>
                  }
                  groups={[{ items: summaryItems }]}
                />
                {txn.moreSummariesAvailable && (
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg border border-[var(--gr-border)] bg-[var(--gr-surface)] px-3 py-2 text-left text-sm italic text-[var(--gr-muted)] hover:bg-[var(--gr-surface-2)]"
                    onClick={txn.showMoreSummaries}
                  >
                    Show more
                  </button>
                )}
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <SectionTabs tabs={tabs} />
            <Outlet />
          </div>
        </div>
      )}
    </div>
  )
}

function buildTransactionTabs(
  basePath: string,
  qs: string,
  active: string,
  permissions:
    | {
        overview: boolean
        traces: boolean
        queries: boolean
        serviceCalls: boolean
        threadProfile: boolean
      }
    | undefined,
  traceCount: number | undefined,
  transactionType: string
): SectionTab[] {
  const tabs = [
    {
      id: 'time',
      label: 'Response time',
      paths: ['average', 'percentiles', 'throughput'],
      href: `${basePath}/average${qs}`,
    },
    permissions?.traces !== false && {
      id: 'traces',
      label: `${transactionType === 'Startup' ? 'Traces' : 'Slow traces'} (${traceCount !== undefined ? traceCount.toLocaleString() : '...'})`,
      paths: ['traces'],
      href: `${basePath}/traces${qs}`,
    },
    permissions?.queries !== false && {
      id: 'queries',
      label: 'Queries',
      paths: ['queries'],
      href: `${basePath}/queries${qs}`,
    },
    permissions?.serviceCalls !== false && {
      id: 'service-calls',
      label: 'Service calls',
      paths: ['service-calls'],
      href: `${basePath}/service-calls${qs}`,
    },
    permissions?.threadProfile !== false && {
      id: 'thread-profile',
      label: 'Thread profile',
      paths: ['thread-profile'],
      href: `${basePath}/thread-profile${qs}`,
    },
  ].filter(Boolean) as Array<{ id: string; label: string; paths: string[]; href: string }>

  return tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: tab.href,
    active: tab.paths.includes(active),
  }))
}

function buildErrorTabs(
  basePath: string,
  qs: string,
  active: string,
  permissions: { overview: boolean; traces: boolean } | undefined
): SectionTab[] {
  const tabs = [
    {
      id: 'messages',
      label: 'Messages',
      paths: ['messages'],
      href: `${basePath}/messages${qs}`,
    },
    permissions?.traces !== false && {
      id: 'traces',
      label: 'Traces',
      paths: ['traces'],
      href: `${basePath}/traces${qs}`,
    },
  ].filter(Boolean) as Array<{ id: string; label: string; paths: string[]; href: string }>

  return tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: tab.href,
    active: tab.paths.includes(active),
  }))
}
