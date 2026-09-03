/*
 * MVP trace detail for /modern — header from /backend/trace/header.
 * Full entry tree / profiles still open in classic UI until ported.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiGet } from '../../lib/api'
import { formatMillis } from '../../lib/formatting'
import { Dialog, DialogFooter, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { PageSpinner } from '../shared/Spinner'
import { HttpError } from '../shared/HttpError'

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
}

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

function TimerRows({ timer, depth = 0 }: { timer: TraceTimer; depth?: number }) {
  return (
    <>
      <tr className="border-t border-gray-100 text-sm">
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

export function TraceDetailModal({ trace, onClose }: TraceDetailModalProps) {
  const [header, setHeader] = useState<TraceHeader | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!trace) {
      setHeader(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setHeader(null)
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

  return (
    <Dialog open={!!trace} onClose={onClose} className="max-w-3xl">
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
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-base font-medium text-gray-900 break-words">
              {header.headline}
            </div>
            <div className="mt-1 text-gray-500">
              {header.transactionType} · {header.transactionName}
              {header.partial ? ' · partial' : ''}
              {header.active ? ' · active' : ''}
            </div>
          </div>

          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-gray-500">Duration</dt>
            <dd className="tabular-nums">{formatMillis(header.durationNanos / 1e6)} ms</dd>
            <dt className="text-gray-500">Start</dt>
            <dd>{new Date(header.startTime).toLocaleString()}</dd>
            {header.user ? (
              <>
                <dt className="text-gray-500">User</dt>
                <dd>{header.user}</dd>
              </>
            ) : null}
            {header.agent ? (
              <>
                <dt className="text-gray-500">Agent</dt>
                <dd>{header.agent}</dd>
              </>
            ) : null}
            {header.entryCount !== undefined ? (
              <>
                <dt className="text-gray-500">Entries</dt>
                <dd className="tabular-nums">{header.entryCount}</dd>
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
                    <dt className="text-gray-500">{name}</dt>
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
                  <tr className="text-left text-xs text-gray-500">
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

          <p className="text-xs text-gray-500">
            Entry tree, queries, and thread profiles are not in /modern yet — use classic UI for the full trace view.
          </p>
        </div>
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
