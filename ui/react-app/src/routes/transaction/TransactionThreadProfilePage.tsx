/*
 * TransactionThreadProfilePage — interactive profile tree with include/exclude filter.
 *
 * Backend: GET /backend/transaction/profile
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTransaction } from '../../contexts/TransactionContext'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface ProfileNode {
  stackTraceElement: string
  sampleCount: number
  ellipsedSampleCount?: number
  childNodes?: ProfileNode[]
}

interface ProfileResponse {
  rootNodes: ProfileNode[]
  unfilteredSampleCount: number
}

interface ProfileData {
  profile: ProfileResponse
  overwritten?: boolean
  hasUnfilteredMainThreadProfile?: boolean
  hasUnfilteredAuxThreadProfile?: boolean
}

function parseIncludesExcludes(filter: string): {
  includes: string[]
  excludes: string[]
  error?: string
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

export function TransactionThreadProfilePage() {
  const txn = useTransaction()
  const { agentRollupId } = useAgent()
  const [searchParams] = useSearchParams()

  const [auxiliary, setAuxiliary] = useState(searchParams.get('auxiliary') === 'true')
  const [filter, setFilter] = useState(searchParams.get('filter') || '')
  const [truncatePct] = useState(
    Number(searchParams.get('truncate-branch-percentage')) || 0.1
  )

  const [profile, setProfile] = useState<ProfileNode | null>(null)
  const [unfilteredSampleCount, setUnfilteredSampleCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [overwritten, setOverwritten] = useState(false)
  const [parsingError, setParsingError] = useState('')
  const [, setHasMain] = useState(false)
  const [hasAux, setHasAux] = useState(false)

  // Expand state
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const fetchData = useCallback(() => {
    if (!agentRollupId || !txn.transactionType) return
    setParsingError('')
    const parseResult = parseIncludesExcludes(filter)
    if (parseResult.error) {
      setParsingError(parseResult.error)
      return
    }

    setLoading(true)
    setError(null)
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

    apiGet<ProfileData>('/backend/transaction/profile', query)
      .then((data) => {
        if (data.overwritten) {
          setOverwritten(true)
          setProfile(null)
          return
        }
        setOverwritten(false)
        setHasMain(!!data.hasUnfilteredMainThreadProfile)
        setHasAux(!!data.hasUnfilteredAuxThreadProfile)
        if (data.profile && data.profile.unfilteredSampleCount) {
          // Build synthetic root node from rootNodes (matching handlebars-rendering.js)
          const rootNode: ProfileNode = {
            stackTraceElement: '',
            sampleCount: 0,
            ellipsedSampleCount: 0,
            childNodes: [],
          }
          for (const node of data.profile.rootNodes) {
            rootNode.sampleCount += node.sampleCount
            rootNode.ellipsedSampleCount = (rootNode.ellipsedSampleCount || 0) + (node.ellipsedSampleCount || 0)
            if (!node.ellipsedSampleCount || node.sampleCount > node.ellipsedSampleCount) {
              rootNode.childNodes!.push(node)
            }
          }
          setProfile(rootNode)
          setUnfilteredSampleCount(data.profile.unfilteredSampleCount)
          // Auto-expand first level
          setExpandedPaths(new Set(['']))
          setShowAll(false)
        } else {
          setProfile(null)
          setUnfilteredSampleCount(0)
        }
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [agentRollupId, txn.transactionType, txn.transactionName, txn.range.chartFrom, txn.range.chartTo, auxiliary, filter, truncatePct])

  useEffect(() => {
    fetchData()
  }, [fetchData, txn.refreshCounter])

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  function expandAll() {
    if (!profile) return
    const paths = new Set<string>()
    function walk(node: ProfileNode, path: string) {
      paths.add(path)
      if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i], path + '/' + i)
        }
      }
    }
    walk(profile, '')
    setExpandedPaths(paths)
    setShowAll(true)
  }

  // Flame graph link
  const qs = txn.buildTabQueryString()
  const flameGraphHref = `/modern/transaction/thread-flame-graph${qs}${auxiliary ? '&auxiliary=true' : ''}${filter ? '&filter=' + encodeURIComponent(filter) : ''}`

  if (loading && !profile) return <PageSpinner />
  if (error && !profile) return <HttpError error={error} />

  return (
    <div className="space-y-4">
      {/* Main / Auxiliary toggle */}
      <div className="flex gap-4 text-sm items-center">
        <button
          className={!auxiliary ? 'font-medium text-blue-600' : 'text-gray-500 hover:text-gray-700'}
          onClick={() => setAuxiliary(false)}
        >
          Main thread
        </button>
        {(hasAux || auxiliary) && (
          <button
            className={auxiliary ? 'font-medium text-blue-600' : 'text-gray-500 hover:text-gray-700'}
            onClick={() => setAuxiliary(true)}
          >
            Auxiliary threads
          </button>
        )}
        <span className="text-gray-300">|</span>
        <Link to={flameGraphHref} className="text-blue-600 hover:underline text-xs">
          View as flame graph
        </Link>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <input
          className="rounded border px-2 py-1 text-sm w-64"
          placeholder="Filter (e.g., com.example -sun.*)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fetchData()
          }}
        />
        <button
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          onClick={fetchData}
        >
          Refresh
        </button>
        {filter && (
          <button
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={() => {
              setFilter('')
            }}
          >
            Clear
          </button>
        )}
      </div>

      {parsingError && (
        <div className="text-sm text-red-600">{parsingError}</div>
      )}

      {overwritten && (
        <div className="rounded-lg border bg-white p-4 text-sm text-orange-700">
          The profile data has expired.
        </div>
      )}

      {/* Profile tree */}
      {profile ? (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3 mb-3 text-xs">
            <span className="text-gray-500">
              {unfilteredSampleCount.toLocaleString()} samples
            </span>
            <button className="text-blue-600 hover:underline" onClick={expandAll}>
              Expand all
            </button>
            <button
              className="text-blue-600 hover:underline"
              onClick={() => {
                setExpandedPaths(new Set(['']))
                setShowAll(false)
              }}
            >
              Collapse all
            </button>
          </div>
          <div className="font-mono text-xs space-y-0">
            <ProfileTree
              node={profile}
              path=""
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              totalSamples={unfilteredSampleCount}
              showAll={showAll}
            />
          </div>
        </div>
      ) : !loading ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          No profile data for selected time range.
        </div>
      ) : null}
    </div>
  )
}

function ProfileTree({
  node,
  path,
  expandedPaths,
  toggleExpand,
  totalSamples,
  showAll,
  depth = 0,
}: {
  node: ProfileNode
  path: string
  expandedPaths: Set<string>
  toggleExpand: (path: string) => void
  totalSamples: number
  showAll: boolean
  depth?: number
}) {
  const expanded = expandedPaths.has(path)
  const hasChildren = node.childNodes && node.childNodes.length > 0
  const pct = totalSamples > 0 ? ((100 * node.sampleCount) / totalSamples).toFixed(1) : '0'
  const indent = depth * 16

  return (
    <>
      <div
        className="flex items-start gap-1 py-0.5 hover:bg-gray-50 cursor-pointer"
        style={{ paddingLeft: indent }}
        onClick={() => hasChildren && toggleExpand(path)}
      >
        <span className="w-4 shrink-0 text-gray-400 select-none">
          {hasChildren ? (expanded ? '▼' : '▶') : ' '}
        </span>
        <span className="text-gray-500 w-14 text-right shrink-0 tabular-nums">
          {pct}%
        </span>
        <span className="ml-1 break-all">
          {node.stackTraceElement || '<root>'}
        </span>
      </div>
      {expanded && hasChildren && (
        <>
          {(showAll ? node.childNodes! : node.childNodes!.slice(0, 20)).map((child, i) => (
            <ProfileTree
              key={i}
              node={child}
              path={path + '/' + i}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              totalSamples={totalSamples}
              showAll={showAll}
              depth={depth + 1}
            />
          ))}
          {!showAll && node.childNodes!.length > 20 && (
            <div className="text-xs text-gray-400 pl-4" style={{ paddingLeft: indent + 16 }}>
              ... and {node.childNodes!.length - 20} more
            </div>
          )}
        </>
      )}
    </>
  )
}
