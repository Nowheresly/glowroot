/*
 * TransactionPercentilesPage — multi-line chart of response time percentiles.
 *
 * Backend: GET /backend/transaction/percentiles
 */

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransaction } from '../../contexts/TransactionContext'
import { useAgent } from '../../contexts/AgentContext'
import { useChartData } from '../../hooks/useChartData'
import { TimeSeriesChart, type PlotSeries } from '../../components/chart'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'
import { formatMillis } from '../../lib/formatting'

interface PercentilesExtra {
  mergedAggregate: unknown
  transactionCounts: Record<number, number>
}

export function TransactionPercentilesPage() {
  const txn = useTransaction()
  const { agentRollup } = useAgent()
  const defaultPercentiles = agentRollup?.defaultPercentiles ?? [50, 95, 99]

  const [percentiles, setPercentiles] = useState<number[]>(defaultPercentiles)
  const [customOpen, setCustomOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const addToQuery = useCallback(
    (query: Record<string, string | string[] | number | undefined>) => {
      query['transaction-type'] = txn.transactionType
      if (txn.transactionName) {
        query['transaction-name'] = txn.transactionName
      }
      query['percentile'] = percentiles.map(String)
    },
    [txn.transactionType, txn.transactionName, percentiles]
  )

  const extractExtra = useCallback(
    (data: Record<string, unknown>): PercentilesExtra => ({
      mergedAggregate: data.mergedAggregate,
      transactionCounts: (data.transactionCounts as Record<number, number>) || {},
    }),
    []
  )

  const { chartData, loading, noData, error } = useChartData<PercentilesExtra>({
    url: '/backend/transaction/percentiles',
    range: txn.range,
    refreshCounter: txn.refreshCounter,
    addToQuery,
    extractExtra,
  })

  const tooltipContent = useCallback(
    (
      from: number,
      to: number | null,
      dataIndex: number,
      seriesIndex: number,
      allSeries: PlotSeries[]
    ) => {
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
        const val = s.data[dataIndex]?.[1]
        const display = val != null ? formatMillis(val) + ' ms' : 'no data'
        html += `<tr${si === seriesIndex ? ' style="background:#eee"' : ''}>`
        html += `<td><span style="display:inline-block;width:10px;height:10px;background:${s.color};border:1px solid #ccc"></span></td>`
        html += `<td>${s.name || 'Other'}</td>`
        html += `<td style="font-weight:600">${display}</td>`
        html += '</tr>'
      }
      html += '</table>'
      return html
    },
    []
  )

  function applyCustomPercentiles() {
    const parsed = customInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => !isNaN(n))
    parsed.sort((a, b) => a - b)
    if (parsed.length > 0) {
      setPercentiles(parsed)
    }
    setCustomOpen(false)
  }

  const qs = txn.buildTabQueryString()
  const basePath = `/modern/${txn.shortName}`

  if (loading && !chartData) return <PageSpinner />
  if (error && !chartData) return <HttpError error={error} />

  return (
    <div className="space-y-4">
      {/* Response time sub-nav */}
      <div className="flex gap-4 text-sm items-center">
        <Link to={`${basePath}/average${qs}`} className="text-gray-500 hover:text-gray-700">
          Average
        </Link>
        <span className="font-medium text-blue-600">Percentiles</span>
        <Link to={`${basePath}/throughput${qs}`} className="text-gray-500 hover:text-gray-700">
          Throughput
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500">
          {percentiles.join(', ')}
        </span>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={() => {
            setCustomInput(percentiles.join(', '))
            setCustomOpen(true)
          }}
        >
          customize
        </button>
      </div>

      {/* Custom percentiles dialog */}
      {customOpen && (
        <div className="rounded-lg border bg-white p-4 flex items-center gap-3">
          <label className="text-sm text-gray-600">Percentiles (comma-separated):</label>
          <input
            className="rounded border px-2 py-1 text-sm w-48"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCustomPercentiles()}
            autoFocus
          />
          <button
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            onClick={applyCustomPercentiles}
          >
            Apply
          </button>
          <button
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => setCustomOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-lg border bg-white p-4">
        {chartData && chartData.dataSeries.length > 0 ? (
          <TimeSeriesChart
            dataSeries={chartData.dataSeries}
            chartFrom={txn.range.chartFrom}
            chartTo={txn.range.chartTo}
            dataPointIntervalMillis={chartData.dataPointIntervalMillis}
            markings={chartData.markings}
            stacked={false}
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
    </div>
  )
}
