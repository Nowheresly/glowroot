import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface GeneralConfig {
  display: string
  defaultDisplay?: string
  version: string
}

export function ConfigGeneralPage() {
  const { agentRollupId, agentRollup } = useAgent()
  const [config, setConfig] = useState<GeneralConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<GeneralConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.general ?? false

  const load = useCallback(async () => {
    if (agentRollupId == null) return
    try {
      const resp = await apiGet<GeneralConfig>('/backend/config/general', {
        'agent-rollup-id': agentRollupId,
      })
      setConfig({ ...resp })
      setOriginalConfig({ ...resp })
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentRollupId])

  useEffect(() => { load() }, [load])

  const hasChanges = config && originalConfig
    ? JSON.stringify(config) !== JSON.stringify(originalConfig)
    : false

  async function handleSave() {
    if (agentRollupId == null) return
    const resp = await apiPost<GeneralConfig>(
      '/backend/config/general?agent-rollup-id=' + encodeURIComponent(agentRollupId),
      config
    )
    setConfig({ ...resp })
    setOriginalConfig({ ...resp })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!config) return null

  return (
    <div className="rounded-lg border bg-white p-6">
      <GtFormGroup label="Agent rollup ID">
        <Input value={agentRollupId ?? ''} disabled />
      </GtFormGroup>
      <GtFormGroup label="Display name">
        <Input
          value={config.display}
          onChange={(e) => setConfig({ ...config, display: e.target.value })}
          placeholder={config.defaultDisplay}
          disabled={!canEdit}
        />
      </GtFormGroup>
      {canEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}
    </div>
  )
}
