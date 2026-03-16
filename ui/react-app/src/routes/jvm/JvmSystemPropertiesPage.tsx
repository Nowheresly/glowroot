import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface SystemProperty {
  name: string
  value: string | string[]
}

interface SystemPropertiesData {
  agentNotConnected?: boolean
  agentUnsupportedOperation?: boolean
  properties: SystemProperty[]
}

export function JvmSystemPropertiesPage() {
  const { agentId } = useAgent()
  const [data, setData] = useState<SystemPropertiesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const resp = await apiGet<SystemPropertiesData>('/backend/jvm/system-properties', {
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
        This operation is not supported by the agent
      </div>
    )
  }

  const sorted = [...data.properties].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Property</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((prop) => (
            <tr key={prop.name}>
              <td className="px-4 py-1.5 font-mono text-xs text-gray-900 whitespace-nowrap">{prop.name}</td>
              <td className="px-4 py-1.5 text-gray-700 break-all">
                {Array.isArray(prop.value) ? prop.value.join(', ') : String(prop.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
