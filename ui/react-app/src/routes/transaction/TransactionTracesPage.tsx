/*
 * TransactionTracesPage — scatter plot of trace points with filter form.
 *
 * Backend: GET /backend/{transaction|error}/points
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransaction } from '../../contexts/TransactionContext'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { TracePointChart, type TracePoint } from '../../components/chart'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'
import { TraceDetailModal, type TraceRef } from '../../components/trace/TraceDetailModal'

interface PointsResponse {
  normalPoints: Array<[number, number, string, string, boolean?]>
  errorPoints: Array<[number, number, string, string, boolean?]>
  partialPoints: Array<[number, number, string, string, boolean?]>
  expired?: boolean
  limitExceeded?: boolean
}

function toTracePoints(
  raw: Array<[number, number, string, string, boolean?]>,
  kind: 'normal' | 'error' | 'partial'
): TracePoint[] {
  return raw.map((p) => ({
    captureTime: p[0],
    durationMs: p[1],
    agentId: p[2],
    traceId: p[3],
    checkLiveTraces: p[4],
    error: kind === 'error',
    partial: kind === 'partial',
  }))
}

const TEXT_COMPARATORS = [
  { value: 'begins', label: 'Begins with' },
  { value: 'equals', label: 'Equals' },
  { value: 'ends', label: 'Ends with' },
  { value: 'contains', label: 'Contains' },
  { value: 'not-contains', label: 'Does not contain' },
]

const DURATION_COMPARATORS = [
  { value: 'greater', label: 'Greater than' },
  { value: 'less', label: 'Less than' },
  { value: 'between', label: 'Between' },
]

const LIMIT_OPTIONS = [100, 200, 500, 1000, 2000, 5000]

export function TransactionTracesPage({ traceKind = 'transaction' }: { traceKind?: 'transaction' | 'error' }) {
  const txn = useTransaction()
  const { agentRollupId } = useAgent()
  const [searchParams] = useSearchParams()

  // Filter state
  const [durationComparator, setDurationComparator] = useState(
    searchParams.get('duration-millis-high') && searchParams.get('duration-millis-low')
      ? 'between'
      : searchParams.get('duration-millis-high')
        ? 'less'
        : 'greater'
  )
  const [durationLow, setDurationLow] = useState(Number(searchParams.get('duration-millis-low')) || 0)
  const [durationHigh, setDurationHigh] = useState<number | undefined>(
    searchParams.get('duration-millis-high') ? Number(searchParams.get('duration-millis-high')) : undefined
  )
  const [headlineComparator, setHeadlineComparator] = useState(searchParams.get('headline-comparator') || 'begins')
  const [headline, setHeadline] = useState(searchParams.get('headline') || '')
  const [errorMessageComparator, setErrorMessageComparator] = useState(searchParams.get('error-message-comparator') || 'begins')
  const [errorMessage, setErrorMessage] = useState(searchParams.get('error-message') || '')
  const [userComparator, setUserComparator] = useState(searchParams.get('user-comparator') || 'begins')
  const [user, setUser] = useState(searchParams.get('user') || '')
  const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 500)

  // Chart data
  const [normalPoints, setNormalPoints] = useState<TracePoint[]>([])
  const [errorPoints, setErrorPoints] = useState<TracePoint[]>([])
  const [partialPoints, setPartialPoints] = useState<TracePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [chartNoData, setChartNoData] = useState(false)
  const [expired, setExpired] = useState(false)
  const [limitExceeded, setLimitExceeded] = useState(false)

  const [selectedTrace, setSelectedTrace] = useState<TraceRef | null>(null)

  const fetchIdRef = useRef(0)
  const showErrorMessageFilter = traceKind === 'error'

  // Fetch points
  const fetchPoints = useCallback(() => {
    if (!agentRollupId || !txn.transactionType) return
    const fetchId = ++fetchIdRef.current
    setLoading(true)
    setError(null)

    const query: Record<string, string | number | undefined> = {
      'agent-rollup-id': agentRollupId,
      'transaction-type': txn.transactionType,
      from: txn.range.chartFrom,
      to: txn.range.chartTo,
      limit,
    }
    if (txn.transactionName) {
      query['transaction-name'] = txn.transactionName
    }
    query['duration-millis-low'] = durationLow
    if (durationHigh !== undefined) {
      query['duration-millis-high'] = durationHigh
    }
    if (headline) {
      query['headline-comparator'] = headlineComparator
      query['headline'] = headline
    }
    if (errorMessage) {
      query['error-message-comparator'] = errorMessageComparator
      query['error-message'] = errorMessage
    }
    if (user) {
      query['user-comparator'] = userComparator
      query['user'] = user
    }

    const endpoint = traceKind === 'error' ? '/backend/error/points' : '/backend/transaction/points'
    apiGet<PointsResponse>(endpoint, query)
      .then((data) => {
        if (fetchId !== fetchIdRef.current) return
        const np = toTracePoints(data.normalPoints, 'normal')
        const ep = toTracePoints(data.errorPoints, 'error')
        const pp = toTracePoints(data.partialPoints, 'partial')
        setNormalPoints(np)
        setErrorPoints(ep)
        setPartialPoints(pp)
        setChartNoData(np.length + ep.length + pp.length === 0)
        setExpired(!!data.expired)
        setLimitExceeded(!!data.limitExceeded)
      })
      .catch((e) => {
        if (fetchId !== fetchIdRef.current) return
        setError(e)
      })
      .finally(() => {
        if (fetchId === fetchIdRef.current) setLoading(false)
      })
  }, [agentRollupId, txn.transactionType, txn.transactionName, txn.range.chartFrom, txn.range.chartTo, durationLow, durationHigh, headlineComparator, headline, errorMessageComparator, errorMessage, userComparator, user, limit, traceKind])

  useEffect(() => {
    fetchPoints()
  }, [fetchPoints, txn.refreshCounter])

  function handlePointClick(point: TracePoint) {
    setSelectedTrace({
      agentId: point.agentId,
      traceId: point.traceId,
      checkLiveTraces: point.checkLiveTraces,
    })
  }

  function clearFilters() {
    setDurationLow(0)
    setDurationHigh(undefined)
    setDurationComparator('greater')
    setHeadlineComparator('begins')
    setHeadline('')
    setErrorMessageComparator('begins')
    setErrorMessage('')
    setUserComparator('begins')
    setUser('')
    setLimit(500)
  }

  if (loading && normalPoints.length === 0 && errorPoints.length === 0 && partialPoints.length === 0) {
    return <PageSpinner />
  }
  if (error && normalPoints.length === 0) return <HttpError error={error} />

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="rounded-lg border bg-white p-4">
        {chartNoData && !loading ? (
          <div className="flex items-center justify-center h-[300px] text-sm text-gray-500">
            {expired ? 'Data has expired' : 'No traces for selected time range and filters'}
          </div>
        ) : (
          <TracePointChart
            normalPoints={normalPoints}
            errorPoints={errorPoints}
            partialPoints={partialPoints}
            chartFrom={txn.range.chartFrom}
            chartTo={txn.range.chartTo}
            durationLow={durationLow}
            durationHigh={durationHigh}
            onZoom={txn.rangeActions.handleZoom}
            onSelection={txn.rangeActions.handleSelection}
            onPointClick={handlePointClick}
          />
        )}
        {limitExceeded && (
          <div className="mt-2 text-xs text-orange-600">
            Limit of {limit.toLocaleString()} trace points exceeded
          </div>
        )}
      </div>

      {/* Filter form */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Filters</h3>

        {/* Duration */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <label className="text-gray-500 w-24">Duration:</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={durationComparator}
            onChange={(e) => {
              setDurationComparator(e.target.value)
              if (e.target.value === 'greater') setDurationHigh(undefined)
              if (e.target.value === 'less') setDurationLow(0)
            }}
          >
            {DURATION_COMPARATORS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {(durationComparator === 'greater' || durationComparator === 'between') && (
            <input
              type="number"
              className="rounded border px-2 py-1 text-sm w-24"
              placeholder="ms"
              value={durationLow || ''}
              onChange={(e) => setDurationLow(Number(e.target.value) || 0)}
            />
          )}
          {durationComparator === 'between' && <span className="text-gray-400">and</span>}
          {(durationComparator === 'less' || durationComparator === 'between') && (
            <input
              type="number"
              className="rounded border px-2 py-1 text-sm w-24"
              placeholder="ms"
              value={durationHigh ?? ''}
              onChange={(e) => setDurationHigh(e.target.value ? Number(e.target.value) : undefined)}
            />
          )}
          <span className="text-gray-400 text-xs">milliseconds</span>
        </div>

        {/* Headline */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <label className="text-gray-500 w-24">Headline:</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={headlineComparator}
            onChange={(e) => setHeadlineComparator(e.target.value)}
          >
            {TEXT_COMPARATORS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            className="rounded border px-2 py-1 text-sm flex-1 min-w-[120px]"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>

        {/* Error message (only for error traces) */}
        {showErrorMessageFilter && (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <label className="text-gray-500 w-24">Error:</label>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={errorMessageComparator}
              onChange={(e) => setErrorMessageComparator(e.target.value)}
            >
              {TEXT_COMPARATORS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              className="rounded border px-2 py-1 text-sm flex-1 min-w-[120px]"
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
            />
          </div>
        )}

        {/* User */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <label className="text-gray-500 w-24">User:</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={userComparator}
            onChange={(e) => setUserComparator(e.target.value)}
          >
            {TEXT_COMPARATORS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            className="rounded border px-2 py-1 text-sm flex-1 min-w-[120px]"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </div>

        {/* Limit */}
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500 w-24">Limit:</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {LIMIT_OPTIONS.map((l) => (
              <option key={l} value={l}>{l.toLocaleString()}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            onClick={fetchPoints}
          >
            Refresh
          </button>
          <button
            className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>
      </div>

      <TraceDetailModal trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
    </div>
  )
}
