import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { useLayout } from '../../contexts/LayoutContext'
import { apiGet } from '../../lib/api'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface EnvironmentData {
  agentNotConnected?: boolean
  host: {
    hostname: string
    availableProcessors: number
    totalPhysicalMemoryBytes: number
    osName: string
    osVersion: string
    currentTime?: number
  }
  process: {
    processId?: number
    startTime: number
  }
  java: {
    version: string
    vm: string
    args: string[]
    glowrootAgentVersion: string
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

function formatDuration(millis: number): string {
  const seconds = Math.floor(millis / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function argFirstPart(arg: string): string {
  const i = arg.indexOf('=')
  if (i === -1) return arg
  return arg.substring(0, i + 1)
}

function argSecondPart(arg: string): string {
  const i = arg.indexOf('=')
  if (i === -1) return ''
  return arg.substring(i + 1)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-4 py-1.5">
      <div className="text-right text-sm font-semibold text-gray-700">{label}</div>
      <div className="col-span-3 text-sm text-gray-900">{children}</div>
    </div>
  )
}

export function JvmEnvironmentPage() {
  const { agentId } = useAgent()
  const { layout } = useLayout()
  const [data, setData] = useState<EnvironmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const resp = await apiGet<EnvironmentData>('/backend/jvm/environment', {
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

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!data) return null

  const uptime = data.host.currentTime
    ? data.host.currentTime - data.process.startTime
    : (!data.agentNotConnected && !layout.offlineViewer ? Date.now() - data.process.startTime : undefined)

  return (
    <div className="space-y-6">
      {data.agentNotConnected && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          The agent is not currently connected. The values below were reported at last JVM start.
        </div>
      )}
      {layout.offlineViewer && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          The values below were reported at last JVM start.
        </div>
      )}

      <fieldset className="rounded-lg border bg-white p-4">
        <legend className="text-sm font-semibold text-gray-700 px-2">Host</legend>
        <Row label="Host name">{data.host.hostname}</Row>
        <Row label="Available processors">{data.host.availableProcessors}</Row>
        <Row label="Total physical memory">{formatBytes(data.host.totalPhysicalMemoryBytes)}</Row>
        <Row label="OS name">{data.host.osName}</Row>
        <Row label="OS version">{data.host.osVersion}</Row>
        {data.host.currentTime !== undefined && (
          <Row label="Current time">
            {data.agentNotConnected || layout.offlineViewer
              ? '-'
              : new Date(data.host.currentTime).toLocaleString()}
          </Row>
        )}
      </fieldset>

      <fieldset className="rounded-lg border bg-white p-4">
        <legend className="text-sm font-semibold text-gray-700 px-2">Process</legend>
        <Row label="Process ID">
          {data.process.processId === undefined ? 'N/A' : data.process.processId}
        </Row>
        <Row label="Start time">{new Date(data.process.startTime).toLocaleString()}</Row>
        <Row label="Uptime">
          {uptime !== undefined ? formatDuration(uptime) : '-'}
        </Row>
      </fieldset>

      <fieldset className="rounded-lg border bg-white p-4">
        <legend className="text-sm font-semibold text-gray-700 px-2">Java</legend>
        <Row label="Version">{data.java.version}</Row>
        <Row label="VM">{data.java.vm}</Row>
        <Row label="Args">
          <div className="space-y-0.5">
            {data.java.args.map((arg, i) => (
              <div key={i} className="break-all">
                <span className="whitespace-nowrap">{argFirstPart(arg)}</span>
                {argSecondPart(arg)}
              </div>
            ))}
          </div>
        </Row>
      </fieldset>

      <fieldset className="rounded-lg border bg-white p-4">
        <legend className="text-sm font-semibold text-gray-700 px-2">Glowroot agent</legend>
        <Row label="Version">{data.java.glowrootAgentVersion}</Row>
      </fieldset>
    </div>
  )
}
