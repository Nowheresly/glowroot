/*
 * TransactionAveragePage — stacked area chart of average response time
 * plus timer breakdown tables (tree + flattened) and thread stats.
 *
 * Backend: GET /backend/transaction/average
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransaction } from '../../contexts/TransactionContext'
import { useChartData } from '../../hooks/useChartData'
import { TimeSeriesChart, type PlotSeries } from '../../components/chart'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'
import { formatMillis } from '../../lib/formatting'

// --- Types ---

interface Timer {
  name: string
  totalNanos: number
  count: number
  extended?: boolean
  childTimers?: Timer[]
}

interface ThreadStats {
  totalCpuNanos: number
  totalBlockedNanos: number
  totalWaitedNanos: number
  totalAllocatedBytes: number
}

interface MergedAggregate {
  transactionCount: number
  mainThreadRootTimers: Timer[]
  auxThreadRootTimers?: Timer[]
  mainThreadStats?: ThreadStats
  auxThreadStats?: ThreadStats
}

interface AverageExtra {
  mergedAggregate: MergedAggregate
  transactionCounts: Record<number, number>
}

// --- Flatten timers ---

interface FlatTimer {
  name: string
  totalNanos: number
  count: number
}

interface TreeTimer {
  name: string
  totalNanos: number
  count: number
  extended?: boolean
  indent: number
  childTimers?: Timer[]
}

function createTreeTimers(rootTimers: Timer[] | undefined): TreeTimer[] {
  if (!rootTimers || rootTimers.length === 0) return []
  const result: TreeTimer[] = []
  const indent1 = 8.41 // px, sync with common-trace.less

  function traverse(timer: Timer, level: number) {
    result.push({
      name: timer.name,
      totalNanos: timer.totalNanos,
      count: timer.count,
      extended: timer.extended,
      indent: level * indent1 * 2,
      childTimers: timer.childTimers,
    })
    if (timer.childTimers) {
      const sorted = [...timer.childTimers].sort((a, b) => b.totalNanos - a.totalNanos)
      for (const child of sorted) {
        traverse(child, level + 1)
      }
    }
  }

  // Handle single vs multiple root nodes
  let root: Timer
  if (rootTimers.length === 1) {
    root = rootTimers[0]
  } else {
    root = {
      name: '<multiple root nodes>',
      totalNanos: rootTimers.reduce((s, t) => s + t.totalNanos, 0),
      count: rootTimers.reduce((s, t) => s + t.count, 0),
      childTimers: rootTimers,
    }
  }
  traverse(root, 0)
  return result
}

function createFlattenedTimers(rootTimers: Timer[] | undefined): FlatTimer[] {
  if (!rootTimers || rootTimers.length === 0) return []
  const map: Record<string, FlatTimer> = {}
  const result: FlatTimer[] = []

  // Handle single vs multiple root nodes
  let root: Timer
  if (rootTimers.length === 1) {
    root = rootTimers[0]
  } else {
    root = {
      name: '<multiple root nodes>',
      totalNanos: rootTimers.reduce((s, t) => s + t.totalNanos, 0),
      count: rootTimers.reduce((s, t) => s + t.count, 0),
      childTimers: rootTimers,
    }
  }

  function traverse(timer: Timer, parentNames: string[]) {
    let flat = map[timer.name]
    if (!flat) {
      flat = {
        name: timer.name,
        totalNanos: timer.totalNanos,
        count: timer.extended ? 0 : timer.count,
      }
      map[timer.name] = flat
      result.push(flat)
    } else if (!parentNames.includes(timer.name)) {
      flat.totalNanos += timer.totalNanos
      if (!timer.extended) {
        flat.count += timer.count
      }
    }
    if (timer.childTimers) {
      for (const child of timer.childTimers) {
        traverse(child, [...parentNames, timer.name])
      }
    }
  }

  traverse(root, [])
  result.sort((a, b) => b.totalNanos - a.totalNanos)
  return result
}

// --- Component ---

export function TransactionAveragePage() {
  const txn = useTransaction()

  const addToQuery = useCallback(
    (query: Record<string, string | string[] | number | undefined>) => {
      query['transaction-type'] = txn.transactionType
      if (txn.transactionName) {
        query['transaction-name'] = txn.transactionName
      }
    },
    [txn.transactionType, txn.transactionName]
  )

  const extractExtra = useCallback(
    (data: Record<string, unknown>): AverageExtra => ({
      mergedAggregate: data.mergedAggregate as MergedAggregate,
      transactionCounts: (data.transactionCounts as Record<number, number>) || {},
    }),
    []
  )

  const { chartData, loading, noData, error } = useChartData<AverageExtra>({
    url: '/backend/transaction/average',
    range: txn.range,
    refreshCounter: txn.refreshCounter,
    addToQuery,
    extractExtra,
  })

  const mergedAggregate = chartData?.extra.mergedAggregate

  const mainTreeTimers = useMemo(
    () => createTreeTimers(mergedAggregate?.mainThreadRootTimers),
    [mergedAggregate]
  )
  const auxTreeTimers = useMemo(
    () => createTreeTimers(mergedAggregate?.auxThreadRootTimers),
    [mergedAggregate]
  )
  const mainFlatTimers = useMemo(
    () => createFlattenedTimers(mergedAggregate?.mainThreadRootTimers),
    [mergedAggregate]
  )
  const auxFlatTimers = useMemo(
    () => createFlattenedTimers(mergedAggregate?.auxThreadRootTimers),
    [mergedAggregate]
  )

  const [timerView, setTimerView] = useState<'tree' | 'flat'>('tree')

  // Tooltip
  const tooltipContent = useCallback(
    (
      from: number,
      to: number | null,
      dataIndex: number,
      seriesIndex: number,
      allSeries: PlotSeries[]
    ) => {
      const total = allSeries.reduce((sum, s) => {
        const val = s.data[dataIndex]?.[1]
        return sum + (val ?? 0)
      }, 0)
      if (total === 0) return 'No data'

      function timeStr(ms: number): string {
        return new Date(ms).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      }

      let html = `<div style="font-weight:600;margin-bottom:2px">${timeStr(from)}`
      if (to) html += ` to ${timeStr(to)}`
      html += '</div><table style="border-spacing:4px 1px">'

      for (let si = 0; si < allSeries.length; si++) {
        const s = allSeries[si]
        const val = s.data[dataIndex]?.[1] ?? 0
        const pct = total > 0 ? ((100 * val) / total).toFixed(1) + ' %' : '0 %'
        html += `<tr${si === seriesIndex ? ' style="background:#eee"' : ''}>`
        html += `<td><span style="display:inline-block;width:10px;height:10px;background:${s.color};border:1px solid #ccc"></span></td>`
        html += `<td>${s.name || 'Other'}</td>`
        html += `<td style="font-weight:600">${pct}</td>`
        html += '</tr>'
      }
      html += '</table>'
      return html
    },
    []
  )

  // Time sub-nav: Average | Percentiles | Throughput
  const qs = txn.buildTabQueryString()
  const basePath = `/modern/${txn.shortName}`

  if (loading && !chartData) return <PageSpinner />
  if (error && !chartData) return <HttpError error={error} />

  return (
    <div className="space-y-4">
      {/* Response time sub-nav */}
      <div className="flex gap-4 text-sm">
        <span className="font-medium text-blue-600">Average</span>
        <Link to={`${basePath}/percentiles${qs}`} className="text-gray-500 hover:text-gray-700">
          Percentiles
        </Link>
        <Link to={`${basePath}/throughput${qs}`} className="text-gray-500 hover:text-gray-700">
          Throughput
        </Link>
      </div>

      {/* Chart */}
      <div className="rounded-lg border bg-white p-4">
        {chartData && chartData.dataSeries.length > 0 ? (
          <TimeSeriesChart
            dataSeries={chartData.dataSeries}
            chartFrom={txn.range.chartFrom}
            chartTo={txn.range.chartTo}
            dataPointIntervalMillis={chartData.dataPointIntervalMillis}
            markings={chartData.markings}
            stacked={true}
            yAxisLabel="milliseconds"
            tooltipContent={tooltipContent}
            onZoom={txn.rangeActions.handleZoom}
            onSelection={txn.rangeActions.handleSelection}
          />
        ) : (
          <div className="flex items-center justify-center h-[300px] text-sm text-gray-500">
            {noData ? 'No data for selected time range' : 'Loading...'}
          </div>
        )}
      </div>

      {/* Timer breakdown */}
      {mergedAggregate && mergedAggregate.transactionCount > 0 && (
        <div className="rounded-lg border bg-white p-4 space-y-4">
          {/* View toggle */}
          <div className="flex gap-4 text-sm">
            <button
              className={timerView === 'tree' ? 'font-medium text-blue-600' : 'text-gray-500 hover:text-gray-700'}
              onClick={() => setTimerView('tree')}
            >
              Tree
            </button>
            <button
              className={timerView === 'flat' ? 'font-medium text-blue-600' : 'text-gray-500 hover:text-gray-700'}
              onClick={() => setTimerView('flat')}
            >
              Flat
            </button>
          </div>

          {/* Main thread timers */}
          {timerView === 'tree' ? (
            <TimerTreeTable title="Main thread" timers={mainTreeTimers} transactionCount={mergedAggregate.transactionCount} />
          ) : (
            <TimerFlatTable title="Main thread" timers={mainFlatTimers} transactionCount={mergedAggregate.transactionCount} />
          )}

          {/* Aux thread timers */}
          {auxTreeTimers.length > 0 && (
            timerView === 'tree' ? (
              <TimerTreeTable title="Auxiliary threads" timers={auxTreeTimers} transactionCount={mergedAggregate.transactionCount} />
            ) : (
              <TimerFlatTable title="Auxiliary threads" timers={auxFlatTimers} transactionCount={mergedAggregate.transactionCount} />
            )
          )}

          {/* Thread stats */}
          {mergedAggregate.mainThreadStats && hasThreadStats(mergedAggregate.mainThreadStats) && (
            <ThreadStatsTable title="Main thread stats" stats={mergedAggregate.mainThreadStats} transactionCount={mergedAggregate.transactionCount} />
          )}
          {mergedAggregate.auxThreadStats && hasThreadStats(mergedAggregate.auxThreadStats) && (
            <ThreadStatsTable title="Auxiliary thread stats" stats={mergedAggregate.auxThreadStats} transactionCount={mergedAggregate.transactionCount} />
          )}
        </div>
      )}
    </div>
  )
}

function hasThreadStats(stats: ThreadStats): boolean {
  return (
    stats.totalCpuNanos !== -1 ||
    stats.totalBlockedNanos !== -1 ||
    stats.totalWaitedNanos !== -1 ||
    stats.totalAllocatedBytes !== -1
  )
}

function TimerTreeTable({
  title,
  timers,
  transactionCount,
}: {
  title: string
  timers: TreeTimer[]
  transactionCount: number
}) {
  if (timers.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-1 font-normal">Timer name</th>
            <th className="py-1 font-normal text-right">Total (ms)</th>
            <th className="py-1 font-normal text-right">Count</th>
            <th className="py-1 font-normal text-right">Avg (ms)</th>
          </tr>
        </thead>
        <tbody>
          {timers.map((timer, i) => {
            const avg = timer.count > 0 ? timer.totalNanos / (1000000 * timer.count) : 0
            return (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-1" style={{ paddingLeft: timer.indent }}>
                  {timer.name}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatMillis(timer.totalNanos / (1000000 * transactionCount))}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {timer.extended ? '' : (timer.count / transactionCount).toFixed(1)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {timer.extended || timer.count === 0 ? '' : formatMillis(avg)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TimerFlatTable({
  title,
  timers,
  transactionCount,
}: {
  title: string
  timers: FlatTimer[]
  transactionCount: number
}) {
  if (timers.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-1 font-normal">Timer name</th>
            <th className="py-1 font-normal text-right">Total (ms)</th>
            <th className="py-1 font-normal text-right">Count</th>
            <th className="py-1 font-normal text-right">Avg (ms)</th>
          </tr>
        </thead>
        <tbody>
          {timers.map((timer, i) => {
            const avg = timer.count > 0 ? timer.totalNanos / (1000000 * timer.count) : 0
            return (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-1">{timer.name}</td>
                <td className="py-1 text-right tabular-nums">
                  {formatMillis(timer.totalNanos / (1000000 * transactionCount))}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {(timer.count / transactionCount).toFixed(1)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {timer.count === 0 ? '' : formatMillis(avg)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ThreadStatsTable({
  title,
  stats,
  transactionCount,
}: {
  title: string
  stats: ThreadStats
  transactionCount: number
}) {
  const rows: Array<{ label: string; value: string }> = []
  if (stats.totalCpuNanos !== -1) {
    rows.push({
      label: 'CPU time',
      value: formatMillis(stats.totalCpuNanos / (1000000 * transactionCount)) + ' ms',
    })
  }
  if (stats.totalBlockedNanos !== -1) {
    rows.push({
      label: 'Blocked time',
      value: formatMillis(stats.totalBlockedNanos / (1000000 * transactionCount)) + ' ms',
    })
  }
  if (stats.totalWaitedNanos !== -1) {
    rows.push({
      label: 'Waited time',
      value: formatMillis(stats.totalWaitedNanos / (1000000 * transactionCount)) + ' ms',
    })
  }
  if (stats.totalAllocatedBytes !== -1) {
    const avgBytes = stats.totalAllocatedBytes / transactionCount
    const mb = avgBytes / (1024 * 1024)
    rows.push({
      label: 'Allocated memory',
      value: mb.toFixed(1) + ' MB',
    })
  }
  if (rows.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <table className="text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-0.5 pr-4 text-gray-500">{row.label}</td>
              <td className="py-0.5 tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
