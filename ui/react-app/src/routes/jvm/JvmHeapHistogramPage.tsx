import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiPost } from '../../lib/api'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface HistogramItem {
  className: string
  bytes: number
  count: number
}

interface HeapHistogramData {
  agentNotConnected?: boolean
  agentUnsupportedOperation?: boolean
  unavailableDueToRunningInJre?: boolean
  unavailableDueToRunningInJ9Jvm?: boolean
  unavailableDueToDockerAlpinePidOne?: boolean
  items: HistogramItem[]
  totalBytes: number
  totalCount: number
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return formatNumber(bytes) + ' bytes'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

type SortAttr = 'className' | 'bytes' | 'count'
type SortDir = 'asc' | 'desc'

export function JvmHeapHistogramPage() {
  const { agentId } = useAgent()
  const [data, setData] = useState<HeapHistogramData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const [filterComparator, setFilterComparator] = useState<'contains' | 'begins' | 'ends'>('contains')
  const [filterValue, setFilterValue] = useState('')
  const [filterLimit, setFilterLimit] = useState(200)
  const [sortAttr, setSortAttr] = useState<SortAttr>('bytes')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const load = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const resp = await apiPost<HeapHistogramData>(
        '/backend/jvm/heap-histogram?agent-id=' + encodeURIComponent(agentId)
      )
      setData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    const fv = filterValue.toLowerCase()
    let items = data.items
    if (fv) {
      items = items.filter((item) => {
        const cn = item.className.toLowerCase()
        if (filterComparator === 'contains') return cn.includes(fv)
        if (filterComparator === 'begins') return cn.startsWith(fv)
        if (filterComparator === 'ends') return cn.endsWith(fv)
        return true
      })
    }
    // Sort
    items = [...items].sort((a, b) => {
      let cmp: number
      if (sortAttr === 'className') {
        cmp = a.className.localeCompare(b.className)
      } else {
        cmp = a[sortAttr] - b[sortAttr]
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [data, filterValue, filterComparator, sortAttr, sortDir])

  const displayedItems = filteredItems.slice(0, filterLimit)
  const maxBytes = displayedItems.length > 0 ? Math.max(...displayedItems.map((i) => i.bytes)) : 1

  function handleSort(attr: SortAttr) {
    if (sortAttr === attr) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortAttr(attr)
      setSortDir(attr === 'className' ? 'asc' : 'desc')
    }
  }

  function sortIndicator(attr: SortAttr) {
    if (sortAttr !== attr) return ''
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  function exportAsCsv() {
    const lines = ['Class name,Bytes,Count']
    for (const item of filteredItems) {
      lines.push(`"${item.className}",${item.bytes},${item.count}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'heap-histogram.csv'
    a.click()
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!data) return null

  if (data.agentNotConnected) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        This feature is only available when the agent is running and connected
      </div>
    )
  }
  if (data.agentUnsupportedOperation || data.unavailableDueToRunningInJre
      || data.unavailableDueToRunningInJ9Jvm || data.unavailableDueToDockerAlpinePidOne) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
        {data.unavailableDueToRunningInJre ? 'This feature requires a JDK (not a JRE)'
          : data.unavailableDueToRunningInJ9Jvm ? 'This feature is not available on IBM J9 / Eclipse OpenJ9 JVMs'
          : data.unavailableDueToDockerAlpinePidOne ? 'This feature is not available in Docker Alpine with PID 1'
          : 'This operation is not supported by the agent'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => load()}>Refresh</Button>
        <Button variant="outline" size="sm" onClick={exportAsCsv}>Export as CSV</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">Class name</span>
        <select
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          value={filterComparator}
          onChange={(e) => setFilterComparator(e.target.value as 'contains' | 'begins' | 'ends')}
        >
          <option value="contains">contains</option>
          <option value="begins">begins with</option>
          <option value="ends">ends with</option>
        </select>
        <Input
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder="Filter..."
          className="w-48"
        />
        <span className="text-sm text-gray-600 ml-4">Display</span>
        <select
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          value={filterLimit}
          onChange={(e) => setFilterLimit(Number(e.target.value))}
        >
          {[100, 200, 500, 1000, 2000, 5000].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-white overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer select-none"
                onClick={() => handleSort('className')}
              >
                Class name{sortIndicator('className')}
              </th>
              <th
                className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer select-none w-40"
                onClick={() => handleSort('bytes')}
              >
                Bytes{sortIndicator('bytes')}
              </th>
              <th
                className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer select-none w-28"
                onClick={() => handleSort('count')}
              >
                Count{sortIndicator('count')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedItems.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-1 font-mono text-xs text-gray-900 break-all">{item.className}</td>
                <td className="px-4 py-1 text-right text-gray-700">
                  <div className="relative">
                    <div
                      className="absolute inset-y-0 right-0 bg-gray-200 rounded-sm"
                      style={{ width: `${(item.bytes / maxBytes) * 100}%` }}
                    />
                    <span className="relative">{formatBytes(item.bytes)}</span>
                  </div>
                </td>
                <td className="px-4 py-1 text-right text-gray-700">{formatNumber(item.count)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td className="px-4 py-2 font-medium text-gray-700">
                Total ({formatNumber(filteredItems.length)} classes
                {filteredItems.length > filterLimit && `, showing ${filterLimit}`})
              </td>
              <td className="px-4 py-2 text-right font-medium text-gray-700">
                {formatBytes(data.totalBytes)}
              </td>
              <td className="px-4 py-2 text-right font-medium text-gray-700">
                {formatNumber(data.totalCount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
