import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface ThreadInfo {
  name: string
  id: number
  state: string
  stackTraceElements: string[]
}

interface TransactionThread {
  headline?: string
  transactionType?: string
  transactionName?: string
  traceId?: string
  durationNanos?: number
  cpuNanos?: number
  threads: ThreadInfo[]
}

interface ThreadDumpData {
  agentNotConnected?: boolean
  deadlockedCycles?: ThreadInfo[][]
  transactions?: TransactionThread[]
  unmatchedThreadsByStackTrace?: ThreadInfo[][]
  threadDumpingThread?: ThreadInfo
}

function nanosToMillis(nanos: number): string {
  return (nanos / 1e6).toFixed(1)
}

function ThreadBlock({ thread }: { thread: ThreadInfo }) {
  const stateClass = thread.state === 'BLOCKED'
    ? 'text-red-600'
    : thread.state === 'WAITING' || thread.state === 'TIMED_WAITING'
      ? 'text-amber-600'
      : ''
  return (
    <div className="mb-1">
      <span>"{thread.name}" #{thread.id}</span>
      {'\n'}
      <span className={stateClass}>
        {'   java.lang.Thread.State: ' + thread.state}
      </span>
      {'\n'}
      {thread.stackTraceElements.map((el, i) => (
        <span key={i}>{'        ' + el + '\n'}</span>
      ))}
    </div>
  )
}

export function JvmThreadDumpPage() {
  const { agentId } = useAgent()
  const [data, setData] = useState<ThreadDumpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const resp = await apiGet<ThreadDumpData>('/backend/jvm/thread-dump', {
        'agent-id': agentId,
      })
      setData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  function exportAsText() {
    if (!data) return
    const lines: string[] = []
    if (data.transactions) {
      lines.push('Matched threads (matched to currently executing transactions):')
      for (const tx of data.transactions) {
        if (tx.transactionType) {
          lines.push(tx.headline || '')
          lines.push('Transaction type: ' + tx.transactionType)
          lines.push('Transaction name: ' + (tx.transactionName || ''))
          if (tx.durationNanos) lines.push('Duration: ' + nanosToMillis(tx.durationNanos) + ' milliseconds')
        }
        for (const t of tx.threads) {
          lines.push(`"${t.name}" #${t.id}`)
          lines.push('   java.lang.Thread.State: ' + t.state)
          for (const el of t.stackTraceElements) lines.push('        ' + el)
        }
        lines.push('')
      }
    }
    if (data.unmatchedThreadsByStackTrace) {
      lines.push('Unmatched threads:')
      for (const group of data.unmatchedThreadsByStackTrace) {
        for (const t of group) {
          lines.push(`"${t.name}" #${t.id}`)
          lines.push('   java.lang.Thread.State: ' + t.state)
          for (const el of t.stackTraceElements) lines.push('        ' + el)
        }
        lines.push('----------------------------------------')
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    window.open(url)
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

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => load()}>Refresh</Button>
        <Button variant="outline" size="sm" onClick={exportAsText}>Export as text</Button>
      </div>
      <pre className="rounded-lg border bg-white p-4 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[80vh]">
        {data.deadlockedCycles && data.deadlockedCycles.length > 0 && (
          <>
            <strong className="underline">Found deadlock:</strong>
            {'\n'}
            {data.deadlockedCycles.map((cycle, i) => (
              <span key={i}>
                {cycle.map((t, j) => (
                  <span key={j}>"{t.name}"{'\n'}</span>
                ))}
                {'\n'}
              </span>
            ))}
          </>
        )}

        {data.transactions && data.transactions.length > 0 && (
          <>
            <strong className="underline">Matched threads</strong>
            {' (matched to currently executing transactions):\n'}
            {data.transactions.map((tx, i) => (
              <span key={i}>
                {tx.transactionType && (
                  <>
                    <strong>{tx.headline}</strong>{'\n'}
                    <strong>Transaction type: </strong>{tx.transactionType}{'\n'}
                    <strong>Transaction name:</strong> {tx.transactionName}{'\n'}
                    <strong>Duration:</strong> {tx.durationNanos ? nanosToMillis(tx.durationNanos) : '?'} milliseconds{'\n'}
                    {tx.cpuNanos !== undefined && tx.cpuNanos !== -1 && (
                      <><strong>CPU time:</strong> {nanosToMillis(tx.cpuNanos)} milliseconds{'\n'}</>
                    )}
                  </>
                )}
                {tx.threads.map((t, j) => <ThreadBlock key={j} thread={t} />)}
                {'\n'}
              </span>
            ))}
          </>
        )}

        {data.unmatchedThreadsByStackTrace && data.unmatchedThreadsByStackTrace.length > 0 && (
          <>
            <strong className="underline">Unmatched threads</strong>
            {' (this may possibly include currently executing transactions that just started or just ended):\n'}
            {data.unmatchedThreadsByStackTrace.map((group, i) => (
              <span key={i}>
                {group.map((t, j) => <ThreadBlock key={j} thread={t} />)}
                {i < data.unmatchedThreadsByStackTrace!.length - 1 && '----------------------------------------\n'}
              </span>
            ))}
          </>
        )}

        {data.threadDumpingThread && (
          <>
            <strong className="underline">Thread dumping thread</strong>
            {' (producing this thread dump):\n'}
            <ThreadBlock thread={data.threadDumpingThread} />
          </>
        )}
      </pre>
    </div>
  )
}
