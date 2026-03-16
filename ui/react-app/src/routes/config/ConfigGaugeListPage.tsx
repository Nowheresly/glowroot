import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface GaugeListItem {
  config: {
    display: string
    version: string
  }
}

export function ConfigGaugeListPage() {
  const { agentId, agentRollup } = useAgent()
  const [gauges, setGauges] = useState<GaugeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.gauges ?? false

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const resp = await apiGet<GaugeListItem[]>('/backend/config/gauges', {
        'agent-id': agentId,
      })
      setGauges(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  return (
    <div>
      <div className="rounded-lg border bg-white">
        {gauges.map((gauge) => (
          <Link
            key={gauge.config.version}
            to={`/modern/config/gauge?agent-id=${encodeURIComponent(agentId!)}&v=${encodeURIComponent(gauge.config.version)}`}
            className="flex items-center px-4 py-3 text-sm text-gray-900 border-b last:border-b-0 no-underline hover:bg-gray-50"
          >
            {gauge.config.display}
          </Link>
        ))}
      </div>
      {canEdit && (
        <div className="mt-4">
          <Link
            to={`/modern/config/gauge?agent-id=${encodeURIComponent(agentId!)}&new`}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 no-underline"
          >
            Add new
          </Link>
        </div>
      )}
    </div>
  )
}
