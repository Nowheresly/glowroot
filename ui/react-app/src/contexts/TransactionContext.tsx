/*
 * TransactionContext — shared state for transaction and error pages.
 *
 * Manages transactionType, transactionName, chart range, sidebar summaries,
 * and tab trace count. These are all shared across the nested transaction/error pages.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAgent } from './AgentContext'
import { useLayout } from './LayoutContext'
import { apiGet } from '../lib/api'
import { useChartRange, type ChartRange, type ChartRangeActions } from '../hooks/useChartRange'
import { formatMillis } from '../lib/formatting'

// --- Summary types ---

export interface TransactionSummary {
  transactionName: string
  totalDurationNanos: number
  transactionCount: number
  errorCount?: number
  totalCpuNanos?: number
  totalAllocatedBytes?: number
}

export interface OverallSummary {
  totalDurationNanos: number
  transactionCount: number
  errorCount?: number
  totalCpuNanos?: number
  totalAllocatedBytes?: number
}

// --- Sort orders ---

export const TRANSACTION_SORT_ORDERS: Record<string, string> = {
  'total-time': 'By total time (%)',
  'average-time': 'By average time',
  'throughput': 'By throughput (per min)',
  'total-cpu-time': 'By total CPU time (%)',
  'average-cpu-time': 'By average CPU time',
  'total-allocated-memory': 'By total allocated memory (%)',
  'average-allocated-memory': 'By average allocated memory',
}

export const ERROR_SORT_ORDERS: Record<string, string> = {
  'error-count': 'By error count',
  'error-rate': 'By error rate',
}

// --- Context value ---

export interface TransactionContextValue {
  shortName: 'transaction' | 'error'
  headerDisplay: string
  transactionType: string
  transactionName: string
  range: ChartRange
  rangeActions: ChartRangeActions
  refreshCounter: number
  overallSummary: OverallSummary | null
  transactionSummaries: TransactionSummary[]
  moreSummariesAvailable: boolean
  summarySortOrder: string
  setSummarySortOrder: (order: string) => void
  summaryLimit: number
  showMoreSummaries: () => void
  summaryValueFn: (summary: TransactionSummary | OverallSummary) => string
  summaryLoading: boolean
  traceCount: number | undefined
  buildTabQueryString: () => string
}

const TransactionCtx = createContext<TransactionContextValue | null>(null)

export function useTransaction(): TransactionContextValue {
  const ctx = useContext(TransactionCtx)
  if (!ctx) throw new Error('useTransaction must be used within TransactionProvider')
  return ctx
}

interface TransactionProviderProps {
  shortName: 'transaction' | 'error'
  children: ReactNode
}

export function TransactionProvider({ shortName, children }: TransactionProviderProps) {
  const { layout } = useLayout()
  const { agentRollup, agentRollupId } = useAgent()
  const [searchParams, setSearchParams] = useSearchParams()

  const headerDisplay =
    shortName === 'transaction' ? 'Transactions' : 'Errors'

  const defaultSortOrder = shortName === 'transaction' ? 'total-time' : 'error-count'

  // --- Read URL params ---
  const transactionType =
    searchParams.get('transaction-type') ||
    agentRollup?.defaultTransactionType ||
    ''
  const transactionName = searchParams.get('transaction-name') || ''

  // --- Chart range ---
  const [range, rangeActions, refreshCounter] = useChartRange(4 * 60 * 60 * 1000)

  // --- Summary state ---
  const [overallSummary, setOverallSummary] = useState<OverallSummary | null>(null)
  const [transactionSummaries, setTransactionSummaries] = useState<TransactionSummary[]>([])
  const [moreSummariesAvailable, setMoreSummariesAvailable] = useState(false)
  const [summaryLimit, setSummaryLimit] = useState(10)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summarySortOrder, setSummarySortOrderState] = useState(
    searchParams.get('summary-sort-order') || defaultSortOrder
  )

  const setSummarySortOrder = useCallback(
    (order: string) => {
      setSummarySortOrderState(order)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (order === defaultSortOrder) {
          next.delete('summary-sort-order')
        } else {
          next.set('summary-sort-order', order)
        }
        return next
      })
    },
    [defaultSortOrder, setSearchParams]
  )

  const showMoreSummaries = useCallback(() => {
    setSummaryLimit((prev) => prev * 2)
  }, [])

  // --- Trace count ---
  const [traceCount, setTraceCount] = useState<number | undefined>(undefined)

  // --- Fetch summaries ---
  const summaryFetchIdRef = useRef(0)
  useEffect(() => {
    if (agentRollupId == null || !transactionType) return
    const fetchId = ++summaryFetchIdRef.current
    setSummaryLoading(true)

    const query: Record<string, string | number> = {
      'agent-rollup-id': agentRollupId,
      'transaction-type': transactionType,
      from: Math.floor(range.chartFrom / 60000) * 60000,
      to: Math.ceil(range.chartTo / 60000) * 60000,
      'sort-order': summarySortOrder,
      limit: summaryLimit,
    }

    apiGet<{
      overall: OverallSummary
      transactions: TransactionSummary[]
      moreAvailable: boolean
    }>(`/backend/${shortName}/summaries`, query)
      .then((data) => {
        if (fetchId !== summaryFetchIdRef.current) return
        setOverallSummary(data.overall)
        setTransactionSummaries(data.transactions)
        setMoreSummariesAvailable(data.moreAvailable)
      })
      .catch(() => {
        // silently fail — summaries are secondary
      })
      .finally(() => {
        if (fetchId === summaryFetchIdRef.current) setSummaryLoading(false)
      })
  }, [
    agentRollupId,
    transactionType,
    range.chartFrom,
    range.chartTo,
    summarySortOrder,
    summaryLimit,
    shortName,
    refreshCounter,
  ])

  // --- Fetch trace count ---
  useEffect(() => {
    const perms =
      shortName === 'transaction'
        ? agentRollup?.permissions?.transaction?.traces
        : agentRollup?.permissions?.error?.traces
    if (!perms || agentRollupId == null || !transactionType) {
      setTraceCount(undefined)
      return
    }
    const query: Record<string, string | number> = {
      'agent-rollup-id': agentRollupId,
      'transaction-type': transactionType,
      from: range.chartFrom,
      to: range.chartTo,
    }
    if (transactionName) {
      query['transaction-name'] = transactionName
    }
    apiGet<number>(`/backend/${shortName}/trace-count`, query)
      .then(setTraceCount)
      .catch(() => setTraceCount(undefined))
  }, [
    agentRollupId,
    transactionType,
    transactionName,
    range.chartFrom,
    range.chartTo,
    shortName,
    agentRollup,
    refreshCounter,
  ])

  // --- Summary value function ---
  const durationMillis = range.chartTo - range.chartFrom
  const summaryValueFn = useCallback(
    (summary: TransactionSummary | OverallSummary): string => {
      if (shortName === 'error') {
        if (summarySortOrder === 'error-count') {
          return String(summary.errorCount ?? 0)
        }
        // error-rate
        if (!summary.transactionCount) return ''
        return ((100 * (summary.errorCount ?? 0)) / summary.transactionCount).toFixed(1) + ' %'
      }
      // transaction sort orders
      if (!overallSummary) return ''
      if (summarySortOrder === 'total-time') {
        if (!overallSummary.totalDurationNanos) return ''
        return (
          (
            (100 * summary.totalDurationNanos) /
            overallSummary.totalDurationNanos
          ).toFixed(1) + ' %'
        )
      }
      if (summarySortOrder === 'average-time') {
        if (!summary.transactionCount) return ''
        return (
          formatMillis(
            summary.totalDurationNanos / (1000000 * summary.transactionCount)
          ) + ' ms'
        )
      }
      if (summarySortOrder === 'throughput') {
        return (
          ((60 * 1000 * summary.transactionCount) / durationMillis).toFixed(1) +
          '/min'
        )
      }
      if (summarySortOrder === 'total-cpu-time') {
        if (!overallSummary.totalCpuNanos) return ''
        return (
          (
            (100 * (summary.totalCpuNanos ?? 0)) /
            overallSummary.totalCpuNanos
          ).toFixed(1) + ' %'
        )
      }
      if (summarySortOrder === 'average-cpu-time') {
        if (!summary.transactionCount) return ''
        return (
          formatMillis(
            (summary.totalCpuNanos ?? 0) / (1000000 * summary.transactionCount)
          ) + ' ms'
        )
      }
      return ''
    },
    [shortName, summarySortOrder, overallSummary, durationMillis]
  )

  // --- Build tab query string ---
  const buildTabQueryString = useCallback(() => {
    const params = new URLSearchParams()
    if (layout.central && agentRollupId) {
      params.set('agent-rollup-id', agentRollupId)
    }
    if (transactionType) {
      params.set('transaction-type', transactionType)
    }
    if (transactionName) {
      params.set('transaction-name', transactionName)
    }
    if (range.last && range.last !== 4 * 60 * 60 * 1000) {
      params.set('last', String(range.last))
    } else if (!range.last) {
      params.set('from', String(range.chartFrom))
      params.set('to', String(range.chartTo))
    }
    const qs = params.toString()
    return qs ? '?' + qs : ''
  }, [layout.central, agentRollupId, transactionType, transactionName, range])

  const value = useMemo<TransactionContextValue>(
    () => ({
      shortName,
      headerDisplay,
      transactionType,
      transactionName,
      range,
      rangeActions,
      refreshCounter,
      overallSummary,
      transactionSummaries,
      moreSummariesAvailable,
      summarySortOrder,
      setSummarySortOrder,
      summaryLimit,
      showMoreSummaries,
      summaryValueFn,
      summaryLoading,
      traceCount,
      buildTabQueryString,
    }),
    [
      shortName,
      headerDisplay,
      transactionType,
      transactionName,
      range,
      rangeActions,
      refreshCounter,
      overallSummary,
      transactionSummaries,
      moreSummariesAvailable,
      summarySortOrder,
      setSummarySortOrder,
      summaryLimit,
      showMoreSummaries,
      summaryValueFn,
      summaryLoading,
      traceCount,
      buildTabQueryString,
    ]
  )

  return (
    <TransactionCtx.Provider value={value}>{children}</TransactionCtx.Provider>
  )
}
