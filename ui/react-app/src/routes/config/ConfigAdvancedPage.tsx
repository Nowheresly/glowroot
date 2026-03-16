import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface AdvancedConfig {
  immediatePartialStoreThresholdSeconds?: number
  maxTransactionAggregates?: number
  maxQueryAggregates?: number
  maxServiceCallAggregates?: number
  maxTraceEntriesPerTransaction?: number
  maxProfileSamplesPerTransaction?: number
  mbeanGaugeNotFoundDelaySeconds?: number
  weavingTimer?: boolean
  version: string
}

export function ConfigAdvancedPage() {
  const { agentRollupId, agentRollup, isRollup } = useAgent()
  const [config, setConfig] = useState<AdvancedConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<AdvancedConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.advanced ?? false

  const load = useCallback(async () => {
    if (!agentRollupId) return
    try {
      const resp = await apiGet<AdvancedConfig>('/backend/config/advanced', {
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
    if (!agentRollupId) return
    const resp = await apiPost<AdvancedConfig>(
      '/backend/config/advanced?agent-rollup-id=' + encodeURIComponent(agentRollupId),
      config
    )
    setConfig({ ...resp })
    setOriginalConfig({ ...resp })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!config) return null

  function setField<K extends keyof AdvancedConfig>(key: K, value: AdvancedConfig[K]) {
    setConfig({ ...config!, [key]: value })
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      {!isRollup && (
        <GtFormGroup label="Immediate partial trace store threshold">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.immediatePartialStoreThresholdSeconds ?? ''}
              onChange={(e) => setField('immediatePartialStoreThresholdSeconds', parseInt(e.target.value) || 0)}
              className="w-24"
              disabled={!canEdit}
            />
            <span className="text-sm text-gray-500">seconds</span>
          </div>
        </GtFormGroup>
      )}
      {!isRollup && (
        <GtFormGroup label="Max transaction aggregates per type">
          <Input
            type="number"
            value={config.maxTransactionAggregates ?? ''}
            onChange={(e) => setField('maxTransactionAggregates', parseInt(e.target.value) || 0)}
            className="w-24"
            disabled={!canEdit}
          />
        </GtFormGroup>
      )}
      <GtFormGroup label="Max query aggregates per transaction aggregate">
        <Input
          type="number"
          value={config.maxQueryAggregates ?? ''}
          onChange={(e) => setField('maxQueryAggregates', parseInt(e.target.value) || 0)}
          className="w-24"
          disabled={!canEdit}
        />
      </GtFormGroup>
      <GtFormGroup label="Max service call aggregates per transaction aggregate">
        <Input
          type="number"
          value={config.maxServiceCallAggregates ?? ''}
          onChange={(e) => setField('maxServiceCallAggregates', parseInt(e.target.value) || 0)}
          className="w-24"
          disabled={!canEdit}
        />
      </GtFormGroup>
      {!isRollup && (
        <GtFormGroup label="Max trace entries per transaction">
          <Input
            type="number"
            value={config.maxTraceEntriesPerTransaction ?? ''}
            onChange={(e) => setField('maxTraceEntriesPerTransaction', parseInt(e.target.value) || 0)}
            className="w-24"
            disabled={!canEdit}
          />
        </GtFormGroup>
      )}
      {!isRollup && (
        <GtFormGroup label="Max profile samples per transaction">
          <Input
            type="number"
            value={config.maxProfileSamplesPerTransaction ?? ''}
            onChange={(e) => setField('maxProfileSamplesPerTransaction', parseInt(e.target.value) || 0)}
            className="w-24"
            disabled={!canEdit}
          />
        </GtFormGroup>
      )}
      {!isRollup && config.mbeanGaugeNotFoundDelaySeconds !== undefined && (
        <GtFormGroup label="MBean gauge not found delay">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.mbeanGaugeNotFoundDelaySeconds}
              onChange={(e) => setField('mbeanGaugeNotFoundDelaySeconds', parseInt(e.target.value) || 0)}
              className="w-24"
              disabled={!canEdit}
            />
            <span className="text-sm text-gray-500">seconds</span>
          </div>
        </GtFormGroup>
      )}
      {!isRollup && config.weavingTimer !== undefined && (
        <GtFormGroup label="Weaving timer">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={config.weavingTimer}
              onCheckedChange={(c) => setField('weavingTimer', !!c)}
              disabled={!canEdit}
            />
            Capture weaving timing
          </label>
        </GtFormGroup>
      )}
      {canEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}
    </div>
  )
}
