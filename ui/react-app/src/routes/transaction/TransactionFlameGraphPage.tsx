/*
 * TransactionFlameGraphPage — D3 flame graph visualization of thread profile.
 *
 * Backend: GET /backend/transaction/flame-graph
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransaction } from '../../contexts/TransactionContext'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { FlameGraph, type FlameGraphNode } from '../../components/chart'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface FlameGraphResponse {
  rootNodes: FlameGraphNode[]
  height: number
  totalSampleCount: number
}

function parseIncludesExcludes(filter: string): {
  includes: string[]
  excludes: string[]
} {
  const includes: string[] = []
  const excludes: string[] = []
  if (!filter) return { includes, excludes }
  const parts = filter.split(/\s+/)
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('-')) {
      excludes.push(part.substring(1))
    } else {
      includes.push(part)
    }
  }
  return { includes, excludes }
}

export function TransactionFlameGraphPage() {
  const txn = useTransaction()
  const { agentRollupId } = useAgent()
  const [searchParams] = useSearchParams()

  const auxiliary = searchParams.get('auxiliary') === 'true'
  const filter = searchParams.get('filter') || ''
  const truncatePct = Number(searchParams.get('truncate-branch-percentage')) || 1.0

  const [rootNodes, setRootNodes] = useState<FlameGraphNode[]>([])
  const [chartHeight, setChartHeight] = useState(0)
  const [noData, setNoData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!agentRollupId || !txn.transactionType) return
    setLoading(true)
    setError(null)
    setNoData(false)

    const parseResult = parseIncludesExcludes(filter)
    const query: Record<string, string | string[] | number | undefined> = {
      'agent-rollup-id': agentRollupId,
      'transaction-type': txn.transactionType,
      from: txn.range.chartFrom,
      to: txn.range.chartTo,
      auxiliary: String(auxiliary),
      'truncate-branch-percentage': truncatePct,
    }
    if (txn.transactionName) {
      query['transaction-name'] = txn.transactionName
    }
    if (parseResult.includes.length) {
      query['include'] = parseResult.includes
    }
    if (parseResult.excludes.length) {
      query['exclude'] = parseResult.excludes
    }

    apiGet<FlameGraphResponse>('/backend/transaction/flame-graph', query)
      .then((data) => {
        if (data.rootNodes.length === 0) {
          setNoData(true)
          setRootNodes([])
          return
        }
        setRootNodes(data.rootNodes)
        setChartHeight(data.height)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [agentRollupId, txn.transactionType, txn.transactionName, txn.range.chartFrom, txn.range.chartTo, auxiliary, filter, truncatePct])

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  if (noData) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
        No profile data for selected time range.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      {rootNodes.length > 0 && (
        <FlameGraph rootNodes={rootNodes} height={chartHeight} />
      )}
    </div>
  )
}
