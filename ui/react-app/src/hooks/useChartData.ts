/*
 * useChartData — data fetching hook for time-series charts.
 *
 * Handles loading state, auto-refresh with document.hidden check,
 * and data point interval calculation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLayout } from '../contexts/LayoutContext'
import { useAgent } from '../contexts/AgentContext'
import { apiGet } from '../lib/api'
import { getDataPointIntervalMillis, isNoData } from '../lib/chart-utils'
import type { ChartRange } from './useChartRange'

export interface DataSeries {
  name: string
  shortLabel?: string
  data: Array<[number, number | null] | null>
}

export interface DeploymentMarking {
  from: number
  to: number
}

export interface ChartData<T = unknown> {
  dataSeries: DataSeries[]
  dataPointIntervalMillis: number
  markings?: DeploymentMarking[]
  /** Extra fields from the response (e.g., mergedAggregate, transactionCounts) */
  extra: T
}

interface UseChartDataOptions<T> {
  url: string
  range: ChartRange
  refreshCounter: number
  /** Additional query params to add (e.g., gauge names, percentiles) */
  addToQuery?: (query: Record<string, string | string[] | number | undefined>) => void
  /** Called after data is fetched — extract extra fields from the raw response */
  extractExtra?: (data: Record<string, unknown>) => T
  /** Auto-refresh interval in ms (default: 60000) */
  autoRefreshDelay?: number
  /** Whether to use gauge view threshold multiplier */
  useGaugeViewThresholdMultiplier?: boolean
  /** Whether this is a trace point chart */
  tracePoints?: boolean
}

export function useChartData<T = unknown>(
  options: UseChartDataOptions<T>
): {
  chartData: ChartData<T> | null
  loading: boolean
  noData: boolean
  error: unknown
  refresh: () => void
} {
  const {
    url,
    range,
    refreshCounter,
    addToQuery,
    extractExtra,
    autoRefreshDelay = 60000,
    useGaugeViewThresholdMultiplier,
  } = options
  const { layout } = useLayout()
  const { agentRollupId } = useAgent()

  const [chartData, setChartData] = useState<ChartData<T> | null>(null)
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const fetchIdRef = useRef(0)

  const fetchData = useCallback(
    async (suppressSpinner?: boolean) => {
      if (!agentRollupId) return
      const fetchId = ++fetchIdRef.current
      if (!suppressSpinner) {
        setLoading(true)
      }
      setError(null)
      try {
        const query: Record<string, string | string[] | number | undefined> = {
          'agent-rollup-id': agentRollupId,
          from: range.chartFrom,
          to: range.chartTo,
        }
        if (addToQuery) {
          addToQuery(query)
        }
        const data = await apiGet<Record<string, unknown>>(url, query)
        if (fetchId !== fetchIdRef.current) return // stale

        const dataSeries = (data.dataSeries as DataSeries[]) || []
        const dataPointIntervalMillis =
          (data.dataPointIntervalMillis as number) ||
          getDataPointIntervalMillis(
            range.chartFrom,
            range.chartTo,
            layout.rollupConfigs,
            layout.rollupExpirationMillis,
            useGaugeViewThresholdMultiplier
          )

        const markings = data.markings as DeploymentMarking[] | undefined
        const extra = extractExtra ? extractExtra(data) : (undefined as unknown as T)

        setChartData({ dataSeries, dataPointIntervalMillis, markings, extra })
        setNoData(isNoData(dataSeries, range.chartFrom, range.chartTo))
      } catch (e) {
        if (fetchId !== fetchIdRef.current) return
        setError(e)
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false)
        }
      }
    },
    [
      url,
      agentRollupId,
      range.chartFrom,
      range.chartTo,
      addToQuery,
      extractExtra,
      layout.rollupConfigs,
      layout.rollupExpirationMillis,
      useGaugeViewThresholdMultiplier,
    ]
  )

  // Fetch on range/refresh changes
  useEffect(() => {
    fetchData()
  }, [fetchData, refreshCounter])

  // Auto-refresh timer (only in "last" mode)
  useEffect(() => {
    if (!range.last || autoRefreshDelay <= 0) return

    let visibilityHandler: (() => void) | null = null

    const timer = setInterval(() => {
      if (document.hidden) {
        // Schedule refresh when tab becomes visible
        if (!visibilityHandler) {
          visibilityHandler = () => {
            fetchData()
            if (visibilityHandler) {
              document.removeEventListener('visibilitychange', visibilityHandler)
              visibilityHandler = null
            }
          }
          document.addEventListener('visibilitychange', visibilityHandler)
        }
      } else {
        fetchData(true) // suppress spinner for auto-refresh
      }
    }, autoRefreshDelay)

    return () => {
      clearInterval(timer)
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
      }
    }
  }, [range.last, autoRefreshDelay, fetchData])

  return {
    chartData,
    loading,
    noData,
    error,
    refresh: () => fetchData(),
  }
}
