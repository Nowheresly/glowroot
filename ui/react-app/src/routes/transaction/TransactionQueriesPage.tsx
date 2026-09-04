/*
 * TransactionQueriesPage — data table of database queries with sorting and detail modal.
 *
 * Backend: GET /backend/transaction/queries
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransaction } from '../../contexts/TransactionContext'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { formatMillis, formatCount } from '../../lib/formatting'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface QueryItem {
  queryType: string
  truncatedQueryText: string
  fullQueryTextSha1?: string
  totalDurationNanos: number
  executionCount: number
  totalRows?: number
  // computed
  timePerExecution?: number
  rowsPerExecution?: number
  text?: string
}

type SortAttr = 'total-time' | 'execution-count' | 'time-per-execution' | 'rows-per-execution'

export function TransactionQueriesPage() {
  const txn = useTransaction()
  const { agentRollupId } = useAgent()
  const [searchParams, setSearchParams] = useSearchParams()

  const [queries, setQueries] = useState<QueryItem[]>([])
  const [limitExceededBucket, setLimitExceededBucket] = useState<QueryItem | undefined>()
  const [queryTypes, setQueryTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [overwritten, setOverwritten] = useState(false)

  // Modal state
  const [modalQuery, setModalQuery] = useState<{ queryType: string; text: string } | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const queryType = searchParams.get('query-type') || ''
  const sortAttribute: SortAttr = (searchParams.get('sort-attribute') as SortAttr) || 'total-time'
  const sortAsc = searchParams.get('sort-direction') === 'asc'

  // Fetch queries
  useEffect(() => {
    if (agentRollupId == null || !txn.transactionType) return
    setLoading(true)
    setError(null)

    const query: Record<string, string | number> = {
      'agent-rollup-id': agentRollupId,
      'transaction-type': txn.transactionType,
      from: txn.range.chartFrom,
      to: txn.range.chartTo,
    }
    if (txn.transactionName) {
      query['transaction-name'] = txn.transactionName
    }

    apiGet<QueryItem[] | { overwritten: boolean }>('/backend/transaction/queries', query)
      .then((data) => {
        if (data && 'overwritten' in data && data.overwritten) {
          setOverwritten(true)
          setQueries([])
          return
        }
        setOverwritten(false)
        const items = data as QueryItem[]

        // Compute derived fields
        const types: Record<string, number> = {}
        for (const q of items) {
          q.timePerExecution = q.totalDurationNanos / (1000000 * q.executionCount)
          q.rowsPerExecution = q.totalRows !== undefined
            ? q.totalRows / q.executionCount
            : undefined
          types[q.queryType] = (types[q.queryType] || 0) + q.totalDurationNanos
        }

        // Extract LIMIT EXCEEDED BUCKET
        let leb: QueryItem | undefined
        const filtered = items.filter((q) => {
          if (q.truncatedQueryText === 'LIMIT EXCEEDED BUCKET') {
            leb = q
            return false
          }
          return true
        })
        setLimitExceededBucket(leb)
        setQueries(filtered)

        const sortedTypes = Object.keys(types).sort(
          (a, b) => (types[b] || 0) - (types[a] || 0)
        )
        setQueryTypes(sortedTypes)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [agentRollupId, txn.transactionType, txn.transactionName, txn.range.chartFrom, txn.range.chartTo, txn.refreshCounter])

  // Sort and filter
  const displayed = useMemo(() => {
    let list = queryType ? queries.filter((q) => q.queryType === queryType) : queries
    list = [...list]

    const sortKey = (q: QueryItem): number => {
      if (sortAttribute === 'total-time') return q.totalDurationNanos
      if (sortAttribute === 'execution-count') return q.executionCount
      if (sortAttribute === 'time-per-execution') return q.timePerExecution ?? 0
      if (sortAttribute === 'rows-per-execution') return q.rowsPerExecution ?? 0
      return q.totalDurationNanos
    }

    list.sort((a, b) => {
      const diff = sortKey(b) - sortKey(a)
      return sortAsc ? -diff : diff
    })
    return list
  }, [queries, queryType, sortAttribute, sortAsc])

  function toggleSort(attr: SortAttr) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (attr === 'total-time' && sortAttribute !== 'total-time') {
        next.delete('sort-attribute')
        next.delete('sort-direction')
      } else if (attr !== 'total-time') {
        next.set('sort-attribute', attr)
      }
      if (sortAttribute === attr && !sortAsc) {
        next.set('sort-direction', 'asc')
      } else {
        next.delete('sort-direction')
      }
      if (attr !== 'total-time') {
        next.set('sort-attribute', attr)
      }
      return next
    })
  }

  function sortIcon(attr: SortAttr) {
    if (sortAttribute !== attr) return ''
    return sortAsc ? ' ↑' : ' ↓'
  }

  // Open query detail
  async function openQueryDetail(q: QueryItem) {
    if (q.fullQueryTextSha1) {
      setModalLoading(true)
      setModalQuery({ queryType: q.queryType, text: '' })
      try {
        const resp = await apiGet<{ fullText?: string; expired?: boolean }>(
          '/backend/transaction/full-query-text',
          { 'agent-rollup-id': agentRollupId!, 'full-text-sha1': q.fullQueryTextSha1 }
        )
        if (resp.expired) {
          setModalQuery({ queryType: q.queryType, text: '[expired]' })
        } else {
          setModalQuery({ queryType: q.queryType, text: resp.fullText || q.truncatedQueryText })
        }
      } catch {
        setModalQuery({ queryType: q.queryType, text: q.truncatedQueryText })
      } finally {
        setModalLoading(false)
      }
    } else {
      setModalQuery({ queryType: q.queryType, text: q.truncatedQueryText })
    }
  }

  if (loading && queries.length === 0) return <PageSpinner />
  if (error && queries.length === 0) return <HttpError error={error} />

  if (overwritten) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-orange-700">
        The query data has expired.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Type filter */}
      {queryTypes.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">Filter by type:</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={queryType}
            onChange={(e) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (e.target.value) {
                  next.set('query-type', e.target.value)
                } else {
                  next.delete('query-type')
                }
                return next
              })
            }}
          >
            <option value="">All types</option>
            {queryTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Queries table */}
      {displayed.length > 0 ? (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-gray-50">
                <th className="py-2 px-3 font-normal">Query</th>
                <th
                  className="py-2 px-3 font-normal text-right cursor-pointer hover:text-gray-700 whitespace-nowrap"
                  onClick={() => toggleSort('total-time')}
                >
                  Total time{sortIcon('total-time')}
                </th>
                <th
                  className="py-2 px-3 font-normal text-right cursor-pointer hover:text-gray-700 whitespace-nowrap"
                  onClick={() => toggleSort('execution-count')}
                >
                  Count{sortIcon('execution-count')}
                </th>
                <th
                  className="py-2 px-3 font-normal text-right cursor-pointer hover:text-gray-700 whitespace-nowrap"
                  onClick={() => toggleSort('time-per-execution')}
                >
                  Time/exec{sortIcon('time-per-execution')}
                </th>
                <th
                  className="py-2 px-3 font-normal text-right cursor-pointer hover:text-gray-700 whitespace-nowrap"
                  onClick={() => toggleSort('rows-per-execution')}
                >
                  Rows/exec{sortIcon('rows-per-execution')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((q, i) => (
                <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <button
                      className="text-left text-blue-600 hover:underline font-mono text-xs break-all"
                      onClick={() => openQueryDetail(q)}
                    >
                      {q.truncatedQueryText.length > 80
                        ? q.truncatedQueryText.substring(0, 77) + '...'
                        : q.truncatedQueryText}
                    </button>
                    {queryType === '' && queryTypes.length > 1 && (
                      <span className="ml-2 text-xs text-gray-400">[{q.queryType}]</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatMillis(q.totalDurationNanos / 1000000)} ms
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {q.executionCount.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatMillis(q.timePerExecution ?? 0)} ms
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {q.rowsPerExecution !== undefined
                      ? formatCount(q.rowsPerExecution)
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {limitExceededBucket && (
            <div className="px-3 py-2 text-xs text-orange-600 border-t bg-orange-50">
              LIMIT EXCEEDED BUCKET — total time:{' '}
              {formatMillis(limitExceededBucket.totalDurationNanos / 1000000)} ms, count:{' '}
              {limitExceededBucket.executionCount.toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          No queries for selected time range.
        </div>
      )}

      {/* Query detail modal */}
      {modalQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalQuery(null)}>
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-medium">{modalQuery.queryType} Query</h3>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => navigator.clipboard.writeText(modalQuery.text)}
                >
                  Copy
                </button>
                <button className="text-gray-400 hover:text-gray-600 text-lg" onClick={() => setModalQuery(null)}>
                  ×
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {modalLoading ? (
                <p className="text-sm text-gray-400">Loading full query text...</p>
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {modalQuery.text}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
