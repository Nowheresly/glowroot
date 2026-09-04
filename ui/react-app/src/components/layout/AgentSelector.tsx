import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useLayout } from '../../contexts/LayoutContext'
import { apiGet } from '../../lib/api'

interface AgentRollupItem {
  id: string
  display: string
  disabled?: boolean
}

export function AgentSelector() {
  const { layout } = useLayout()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [agents, setAgents] = useState<AgentRollupItem[]>([])
  const [loading, setLoading] = useState(false)

  const currentAgentId = searchParams.get('agent-id')
  const currentAgentRollupId = searchParams.get('agent-rollup-id')
  const selectedId = currentAgentRollupId || currentAgentId || ''

  const fetchAgents = useCallback(async () => {
    if (!layout.central) return
    setLoading(true)
    try {
      const now = Date.now()
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000
      const resp = await apiGet<AgentRollupItem[]>('/backend/top-level-agent-rollups', {
        from: String(weekAgo),
        to: String(now),
      })
      setAgents(resp)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [layout.central])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  if (!layout.central) return null

  function handleChange(newId: string) {
    if (!newId) return
    // Determine if this is a rollup (ends with ::) or agent
    const isRollup = newId.endsWith('::')
    const paramName = isRollup ? 'agent-rollup-id' : 'agent-id'
    // Build new search params, replacing agent params
    const newParams = new URLSearchParams()
    newParams.set(paramName, newId)
    // Preserve non-agent search params
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'agent-id' && key !== 'agent-rollup-id') {
        newParams.set(key, value)
      }
    }
    navigate(location.pathname + '?' + newParams.toString())
  }

  return (
    <select
      className="h-8 min-w-[10rem] rounded-md border border-[var(--gr-border)] bg-[var(--gr-surface)] px-2 text-sm text-[var(--gr-text)] focus:outline-none focus:ring-1 focus:ring-[var(--gr-accent)]"
      value={selectedId}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      aria-label="Select agent"
    >
      {!selectedId && (
        <option value="" disabled>
          {loading ? 'Loading...' : 'Select agent...'}
        </option>
      )}
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id} disabled={agent.disabled}>
          {agent.display}
        </option>
      ))}
      {agents.length === 0 && !loading && (
        <option value="" disabled>
          No active agents in the past 7 days
        </option>
      )}
    </select>
  )
}
