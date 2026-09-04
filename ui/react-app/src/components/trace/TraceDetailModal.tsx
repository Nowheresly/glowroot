/*
 * Trace detail for /modern — header + entries tree.
 * Profiles / flame still via classic link.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiGet, ApiError } from '../../lib/api'
import { formatMillis } from '../../lib/formatting'
import { Dialog, DialogFooter, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { PageSpinner } from '../shared/Spinner'
import { HttpError } from '../shared/HttpError'
import { cn } from '../../lib/utils'

export interface TraceRef {
  agentId: string
  traceId: string
  checkLiveTraces?: boolean
}

interface TraceTimer {
  name: string
  totalNanos: number
  count: number
  childTimers?: TraceTimer[]
}

interface TraceHeader {
  expired?: boolean
  active?: boolean
  partial?: boolean
  startTime: number
  captureTime: number
  durationNanos: number
  transactionType: string
  transactionName: string
  headline: string
  user?: string
  error?: { message?: string }
  attributes?: Record<string, string[]>
  entryCount?: number
  mainThreadRootTimer?: TraceTimer
  agent?: string
  entriesExistence?: string
}

interface SharedQueryText {
  fullText?: string
  truncatedText?: string
  truncatedEndText?: string
}

interface TraceEntry {
  startOffsetNanos: number
  durationNanos: number
  active?: boolean
  message?: string
  queryMessage?: {
    sharedQueryTextIndex: number
    prefix?: string
    suffix?: string
  }
  error?: { message?: string }
  childEntries?: TraceEntry[]
}

interface EntriesResponse {
  entries: TraceEntry[]
  sharedQueryTexts?: SharedQueryText[]
}

type TabId = 'overview' | 'entries'

interface TraceDetailModalProps {
  trace: TraceRef | null
  onClose: () => void
}

function classicTraceUrl(trace: TraceRef): string {
  let url = `${window.location.origin}/transaction/traces?modal-agent-id=${encodeURIComponent(trace.agentId)}&modal-trace-id=${encodeURIComponent(trace.traceId)}`
  if (trace.checkLiveTraces) {
    url += '&modal-check-live-traces=true'
  }
  return url
}

function exportUrl(trace: TraceRef): string {
  let url = `/export/trace?agent-id=${encodeURIComponent(trace.agentId)}&trace-id=${encodeURIComponent(trace.traceId)}`
  if (trace.checkLiveTraces) {
    url += '&check-live-traces=true'
  }
  return url
}

function entryMessage(entry: TraceEntry, shared: SharedQueryText[] | undefined): string {
  if (entry.queryMessage) {
    const sq = shared?.[entry.queryMessage.sharedQueryTextIndex]
    const sql = sq?.fullText || sq?.truncatedText || ''
    return `${entry.queryMessage.prefix || ''}${sql}${entry.queryMessage.suffix || ''}`
  }
  return entry.message || ''
}

function TimerRows({ timer, depth = 0 }: { timer: TraceTimer; depth?: number }) {
  return (
    <>
      <tr className="border-t border-[var(--gr-border)] text-sm">
        <td className="py-1 pr-3" style={{ paddingLeft: depth * 12 }}>
          {timer.name}
        </td>
        <td className="py-1 pr-3 text-right tabular-nums">{timer.count}</td>
        <td className="py-1 text-right tabular-nums">
          {formatMillis(timer.totalNanos / 1e6)} ms
        </td>
      </tr>
      {timer.childTimers?.map((child, i) => (
        <TimerRows key={`${child.name}-${i}`} timer={child} depth={depth + 1} />
      ))}
    </>
  )
}

function EntryNode({
  entry,
  shared,
  depth = 0,
}: {
  entry: TraceEntry
  shared?: SharedQueryText[]
  depth?: number
}) {
  const msg = entryMessage(entry, shared)
  const hasError = !!entry.error?.message
  return (
    <div className="border-b border-[var(--gr-border)] last:border-b-0">
      <div
        className={cn(
          'flex gap-3 py-1.5 text-sm',
          hasError && 'bg-red-50'
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span className="w-16 shrink-0 text-right tabular-nums text-[var(--gr-muted)]">
          {formatMillis(entry.startOffsetNanos / 1e6)}
        </span>
        <span className="w-16 shrink-0 text-right tabular-nums">
          {formatMillis(entry.durationNanos / 1e6)}
        </span>
        <span className={cn('min-w-0 flex-1 break-words', hasError && 'text-red-800')}>
          {msg || '(no message)'}
          {entry.active ? ' (active)' : ''}
          {hasError ? ` — ${entry.error!.message}` : ''}
        </span>
      </div>
      {entry.childEntries?.map((child, i) => (
        <EntryNode key={i} entry={child} shared={shared} depth={depth + 1} />
      ))}
    </div>
  )
}

export function TraceDetailModal({ trace, onClose }: TraceDetailModalProps) {
  const [tab, setTab] = useState<TabId>('overview')
  const [header, setHeader] = useState<TraceHeader | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const [entries, setEntries] = useState<TraceEntry[] | null>(null)
  const [sharedQueryTexts, setSharedQueryTexts] = useState<SharedQueryText[] | undefined>()
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entriesError, setEntriesError] = useState<unknown>(null)
  const [entriesEmpty, setEntriesEmpty] = useState(false)

  useEffect(() => {
    if (!trace) {
      setHeader(null)
      setError(null)
      setTab('overview')
      setEntries(null)
      setSharedQueryTexts(undefined)
      setEntriesError(null)
      setEntriesEmpty(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setHeader(null)
    setEntries(null)
    setEntriesEmpty(false)
    setEntriesError(null)
    apiGet<TraceHeader>('/backend/trace/header', {
      'agent-id': trace.agentId,
      'trace-id': trace.traceId,
      'check-live-traces': trace.checkLiveTraces ? 'true' : undefined,
    })
      .then((data) => {
        if (!cancelled) setHeader(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [trace])

  useEffect(() => {
    if (!trace || tab !== 'entries' || entries !== null || entriesEmpty) return
    let cancelled = false
    setEntriesLoading(true)
    setEntriesError(null)
    apiGet<EntriesResponse>('/backend/trace/entries', {
      'agent-id': trace.agentId,
      'trace-id': trace.traceId,
      'check-live-traces': trace.checkLiveTraces ? 'true' : undefined,
    })
      .then((data) => {
        if (cancelled) return
        if (!data.entries?.length) {
          setEntriesEmpty(true)
          setEntries([])
        } else {
          setEntries(data.entries)
          setSharedQueryTexts(data.sharedQueryTexts)
        }
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) {
          setEntriesEmpty(true)
          setEntries([])
        } else {
          setEntriesError(e)
        }
      })
      .finally(() => {
        if (!cancelled) setEntriesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [trace, tab, entries, entriesEmpty])

  return (
    <Dialog open={!!trace} onClose={onClose} className="max-w-5xl max-h-[90vh]">
      <div className="mb-2 flex items-start justify-between gap-4">
        <DialogTitle>Trace</DialogTitle>
        <button
          type="button"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading && <PageSpinner />}
      {!loading && error ? <HttpError error={error} /> : null}
      {!loading && !error && header?.expired && (
        <p className="text-sm text-gray-600">This trace has expired.</p>
      )}
      {!loading && !error && header && !header.expired && (
        <>
          <div className="mb-3 border-b border-[var(--gr-border)]">
            <div className="flex gap-1">
              {([
                ['overview', 'Overview'],
                ['entries', 'Entries'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    tab === id
                      ? 'border-[var(--gr-accent)] text-[var(--gr-accent)]'
                      : 'border-transparent text-[var(--gr-muted)] hover:text-gray-800'
                  )}
                >
                  {label}
                  {id === 'entries' && header.entryCount !== undefined
                    ? ` (${header.entryCount})`
                    : ''}
                </button>
              ))}
            </div>
          </div>

          {tab === 'overview' && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-base font-medium text-gray-900 break-words">
                  {header.headline}
                </div>
                <div className="mt-1 text-[var(--gr-muted)]">
                  {header.transactionType} · {header.transactionName}
                  {header.partial ? ' · partial' : ''}
                  {header.active ? ' · active' : ''}
                </div>
              </div>

              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
                <dt className="text-[var(--gr-muted)]">Duration</dt>
                <dd className="tabular-nums">{formatMillis(header.durationNanos / 1e6)} ms</dd>
                <dt className="text-[var(--gr-muted)]">Start</dt>
                <dd>{new Date(header.startTime).toLocaleString()}</dd>
                {header.user ? (
                  <>
                    <dt className="text-[var(--gr-muted)]">User</dt>
                    <dd>{header.user}</dd>
                  </>
                ) : null}
                {header.agent ? (
                  <>
                    <dt className="text-[var(--gr-muted)]">Agent</dt>
                    <dd>{header.agent}</dd>
                  </>
                ) : null}
              </dl>

              {header.error?.message && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                  {header.error.message}
                </div>
              )}

              {header.attributes && Object.keys(header.attributes).length > 0 && (
                <div>
                  <h3 className="mb-1 font-medium text-gray-800">Attributes</h3>
                  <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
                    {Object.entries(header.attributes).map(([name, values]) => (
                      <div key={name} className="contents">
                        <dt className="text-[var(--gr-muted)]">{name}</dt>
                        <dd className="break-all">{values.join(', ')}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {header.mainThreadRootTimer && (
                <div>
                  <h3 className="mb-1 font-medium text-gray-800">Timers</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-[var(--gr-muted)]">
                        <th className="pb-1 font-medium">Name</th>
                        <th className="pb-1 font-medium text-right">Count</th>
                        <th className="pb-1 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <TimerRows timer={header.mainThreadRootTimer} />
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'entries' && (
            <div className="text-sm">
              {entriesLoading && <PageSpinner />}
              {!entriesLoading && entriesError ? <HttpError error={entriesError} /> : null}
              {!entriesLoading && !entriesError && (entriesEmpty || entries?.length === 0) && (
                <p className="text-[var(--gr-muted)]">No entries</p>
              )}
              {!entriesLoading && !entriesError && entries && entries.length > 0 && (
                <>
                  <div className="mb-1 flex gap-3 px-2 text-xs font-medium text-[var(--gr-muted)]">
                    <span className="w-16 text-right">Offset</span>
                    <span className="w-16 text-right">Total</span>
                    <span>Message</span>
                  </div>
                  <div className="max-h-[50vh] overflow-auto rounded border border-[var(--gr-border)]">
                    {entries.map((e, i) => (
                      <EntryNode key={i} entry={e} shared={sharedQueryTexts} />
                    ))}
                  </div>
                </>
              )}
              <p className="mt-3 text-xs text-[var(--gr-muted)]">
                Thread profiles and flame graphs: use Full view (classic) for now.
              </p>
            </div>
          )}
        </>
      )}

      {trace && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={() => { window.location.href = exportUrl(trace) }}>
            Export
          </Button>
          <Button
            variant="default"
            onClick={() => window.open(classicTraceUrl(trace), '_blank')}
          >
            Full view (classic)
          </Button>
        </DialogFooter>
      )}
    </Dialog>
  )
}
