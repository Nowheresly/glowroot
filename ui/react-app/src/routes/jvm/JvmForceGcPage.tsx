import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface GcCheckData {
  agentNotConnected?: boolean
  explicitGcDisabled?: boolean
}

export function JvmForceGcPage() {
  const { agentId } = useAgent()
  const [data, setData] = useState<GcCheckData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const resp = await apiGet<GcCheckData>('/backend/jvm/explicit-gc-disabled', {
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

  async function handleForceGc() {
    if (!agentId) return
    setRunning(true)
    setResult(null)
    try {
      await apiPost('/backend/jvm/force-gc?agent-id=' + encodeURIComponent(agentId))
      setResult('GC initiated successfully')
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Failed')
    } finally {
      setRunning(false)
    }
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
    <div className="rounded-lg border bg-white p-6">
      {data.explicitGcDisabled && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          Explicit GC is disabled (-XX:+DisableExplicitGC)
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button onClick={handleForceGc} loading={running} disabled={data.explicitGcDisabled}>
          Force GC
        </Button>
        {result && (
          <span className="text-sm text-green-600">{result}</span>
        )}
      </div>
    </div>
  )
}
