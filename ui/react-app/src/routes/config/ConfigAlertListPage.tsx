import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface AlertSummary {
  version: string
  display: string
}

interface AlertListData {
  alerts: AlertSummary[]
  disabledForNextMillis?: number
}

export function ConfigAlertListPage() {
  const { agentRollupId, agentRollup, agentQueryString } = useAgent()
  const [data, setData] = useState<AlertListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.alerts ?? false

  const load = useCallback(async () => {
    if (agentRollupId == null) return
    try {
      const resp = await apiGet<AlertListData>('/backend/config/alerts', {
        'agent-rollup-id': agentRollupId,
      })
      setData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentRollupId])

  useEffect(() => { load() }, [load])

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!data) return null

  const qs = agentQueryString()

  return (
    <div>
      {data.disabledForNextMillis != null && data.disabledForNextMillis > 0 && (
        <p className="mb-4 text-sm text-amber-600">
          Alerting is disabled for the next {Math.ceil(data.disabledForNextMillis / 60000)} minutes.
        </p>
      )}
      <div className="rounded-lg border bg-white">
        {data.alerts.map((alert) => (
          <Link
            key={alert.version}
            to={`/modern/config/alert${qs}${qs ? '&' : '?'}v=${encodeURIComponent(alert.version)}`}
            className="flex items-center px-4 py-3 text-sm text-gray-900 border-b last:border-b-0 no-underline hover:bg-gray-50"
          >
            {alert.display}
          </Link>
        ))}
        {data.alerts.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500">No alerts configured.</p>
        )}
      </div>
      {canEdit && (
        <div className="mt-4">
          <Link
            to={`/modern/config/alert${qs}${qs ? '&' : '?'}new`}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 no-underline"
          >
            Add new
          </Link>
        </div>
      )}
    </div>
  )
}
