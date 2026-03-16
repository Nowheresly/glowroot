import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface JstackData {
  agentNotConnected?: boolean
  agentUnsupportedOperation?: boolean
  unavailableDueToRunningInJre?: boolean
  unavailableDueToRunningInJ9Jvm?: boolean
  jstack?: string
}

export function JvmJstackPage() {
  const { agentId } = useAgent()
  const [data, setData] = useState<JstackData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const resp = await apiGet<JstackData>('/backend/jvm/jstack', {
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
    if (!data?.jstack) return
    const blob = new Blob([data.jstack], { type: 'text/plain' })
    window.open(URL.createObjectURL(blob))
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
  if (data.agentUnsupportedOperation) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
        This feature requires Glowroot agent version 0.9.2 or later
      </div>
    )
  }
  if (data.unavailableDueToRunningInJre) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
        This feature requires a JDK (not a JRE)
      </div>
    )
  }
  if (data.unavailableDueToRunningInJ9Jvm) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
        This feature is not available on IBM J9 / Eclipse OpenJ9 JVMs
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
        {data.jstack}
      </pre>
    </div>
  )
}
