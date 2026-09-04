/*
 * TransactionThroughputPage — single line chart of transactions per minute.
 *
 * Backend: GET /backend/transaction/throughput
 */

import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTransaction } from '../../contexts/TransactionContext'
import { useChartData } from '../../hooks/useChartData'
import { TimeSeriesChart, type PlotSeries } from '../../components/chart'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'
import { formatMillis } from '../../lib/formatting'

interface ThroughputExtra {
  transactionCount: number
  transactionsPerMin: number
}

export function TransactionThroughputPage() {
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
    (data: Record<string, unknown>): ThroughputExtra => ({
      transactionCount: (data.transactionCount as number) || 0,
      transactionsPerMin: (data.transactionsPerMin as number) || 0,
    }),
    []
  )

  const { chartData, loading, noData, error } = useChartData<ThroughputExtra>({
    url: '/backend/transaction/throughput',
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
      _seriesIndex: number,
      allSeries: PlotSeries[]
    ) => {
      const val = allSeries[0]?.data[dataIndex]?.[1]
      if (val == null || val === 0) return 'No data'

      function timeStr(ms: number): string {
        return new Date(ms).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      }

      let html = `<div style="font-weight:600;margin-bottom:2px">${timeStr(from)}`
      if (to) html += ` to ${timeStr(to)}`
      html += '</div>'
      html += `<div>${formatMillis(val)} transactions per minute</div>`
      return html
    },
    []
  )

  const qs = txn.buildTabQueryString()
  const basePath = `/modern/${txn.shortName}`

  if (loading && !chartData) return <PageSpinner />
  if (error && !chartData) return <HttpError error={error} />

  return (
    <div className="space-y-4">
      {/* Response time sub-nav */}
      <div className="flex gap-4 text-sm">
        <Link to={`${basePath}/average${qs}`} className="text-[var(--gr-muted)] hover:text-[var(--gr-text)]">
          Average
        </Link>
        <Link to={`${basePath}/percentiles${qs}`} className="text-[var(--gr-muted)] hover:text-[var(--gr-text)]">
          Percentiles
        </Link>
        <span className="font-medium text-[var(--gr-accent)]">Throughput</span>
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
            stacked={false}
            yAxisLabel="transactions per minute"
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
