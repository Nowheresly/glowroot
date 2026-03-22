/*
 * TransactionLayout — shared layout for transaction and error pages.
 *
 * Provides: header with transaction type dropdown, sidebar with summaries,
 * tab bar, and child page outlet.
 */

import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { cn } from '../../lib/utils'
import {
  useTransaction,
  TRANSACTION_SORT_ORDERS,
  ERROR_SORT_ORDERS,
} from '../../contexts/TransactionContext'
import { useAgent } from '../../contexts/AgentContext'
import { useLayout } from '../../contexts/LayoutContext'
import { ChartRangeSelector } from '../../components/chart/ChartRangeSelector'

export function TransactionLayout() {
  const { layout } = useLayout()
  const { agentRollup, agentRollupId } = useAgent()
  const txn = useTransaction()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

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

  // Current tab path segment
  const basePath = `/modern/${txn.shortName}`
  const pathAfterBase = location.pathname.replace(basePath + '/', '')

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        {displayName && (
          <>
            <span className="text-xl font-semibold text-gray-900">{displayName}</span>
            <span className="text-gray-400">|</span>
          </>
        )}
        <h1 className="text-xl font-semibold text-gray-900">{txn.headerDisplay}</h1>

        {/* Transaction type dropdown */}
        {showTypeDropdown && (
          <select
            className="rounded border px-2 py-1 text-sm"
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
      </div>

      {needsAgent ? (
        <p className="text-sm text-gray-500">Please select an agent from the dropdown above.</p>
      ) : !txn.transactionType ? (
        <p className="text-sm text-gray-500">No transaction types available.</p>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-52 shrink-0 print:hidden">
            {/* Sort order dropdown */}
            <div className="mb-1 rounded-md border bg-white">
              <select
                className="w-full rounded-md px-3 py-2 text-sm border-0 bg-transparent"
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

            {/* Summaries list */}
            <div className="rounded-md border bg-white">
              <div className="flex flex-col">
                {txn.summaryLoading && txn.transactionSummaries.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                    Loading...
                  </div>
                ) : txn.transactionSummaries.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-gray-500 font-medium">
                    No data for this time period
                  </div>
                ) : (
                  <>
                    {/* Overall */}
                    <Link
                      to={`${location.pathname}${sidebarQs(null)}`}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-sm no-underline border-b',
                        !txn.transactionName
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <span className="break-all">
                        All {txn.transactionType}
                      </span>
                      {txn.overallSummary && (
                        <span className="ml-2 whitespace-nowrap text-xs text-gray-500">
                          {txn.summaryValueFn(txn.overallSummary)}
                        </span>
                      )}
                    </Link>
                    <div className="h-[3px] bg-gray-100" />
                    {/* Individual transactions */}
                    {txn.transactionSummaries.map((s) => (
                      <Link
                        key={s.transactionName}
                        to={`${location.pathname}${sidebarQs(s.transactionName)}`}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 text-sm no-underline border-b last:border-b-0',
                          txn.transactionName === s.transactionName
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <span className="break-all">{s.transactionName}</span>
                        <span className="ml-2 whitespace-nowrap text-xs text-gray-500">
                          {txn.summaryValueFn(s)}
                        </span>
                      </Link>
                    ))}
                    {txn.moreSummariesAvailable && (
                      <button
                        className="px-3 py-2 text-sm text-gray-500 italic hover:bg-gray-50 w-full text-left"
                        onClick={txn.showMoreSummaries}
                      >
                        Show more
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {/* Chart range selector */}
            <ChartRangeSelector range={txn.range} actions={txn.rangeActions} />

            {/* Tab bar */}
            <div className="mt-4 mb-4">
              <nav className="flex border-b">
                {isTransaction ? (
                  <TransactionTabs
                    basePath={basePath}
                    qs={txn.buildTabQueryString()}
                    active={pathAfterBase}
                    permissions={agentRollup?.permissions?.transaction}
                    traceCount={txn.traceCount}
                    transactionType={txn.transactionType}
                  />
                ) : (
                  <ErrorTabs
                    basePath={basePath}
                    qs={txn.buildTabQueryString()}
                    active={pathAfterBase}
                    permissions={agentRollup?.permissions?.error}
                  />
                )}
              </nav>
            </div>

            {/* Page content */}
            <Outlet />
          </div>
        </div>
      )}
    </div>
  )
}

function TransactionTabs({
  basePath,
  qs,
  active,
  permissions,
  traceCount,
  transactionType,
}: {
  basePath: string
  qs: string
  active: string
  permissions?: { overview: boolean; traces: boolean; queries: boolean; serviceCalls: boolean; threadProfile: boolean }
  traceCount?: number
  transactionType: string
}) {
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

  return (
    <>
      {tabs.map((tab) => {
        const isActive = tab.paths.includes(active)
        return (
          <Link
            key={tab.id}
            to={tab.href}
            className={cn(
              'px-4 py-2 text-sm no-underline border-b-2 -mb-px',
              isActive
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </>
  )
}

function ErrorTabs({
  basePath,
  qs,
  active,
  permissions,
}: {
  basePath: string
  qs: string
  active: string
  permissions?: { overview: boolean; traces: boolean }
}) {
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

  return (
    <>
      {tabs.map((tab) => {
        const isActive = tab.paths.includes(active)
        return (
          <Link
            key={tab.id}
            to={tab.href}
            className={cn(
              'px-4 py-2 text-sm no-underline border-b-2 -mb-px',
              isActive
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </>
  )
}
