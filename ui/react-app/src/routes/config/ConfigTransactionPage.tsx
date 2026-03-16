import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface SlowThresholdOverride {
  transactionType: string
  transactionName: string
  user: string
  thresholdMillis: number | null
}

interface TransactionConfig {
  slowThresholdMillis: number
  profilingIntervalMillis: number
  captureThreadStats: boolean
  slowThresholdOverrides: SlowThresholdOverride[]
  version: string
}

interface TransactionData {
  config: TransactionConfig
  defaultTransactionType: string
  allTransactionTypes: string[]
}

export function ConfigTransactionPage() {
  const { agentId, agentRollup } = useAgent()
  const [data, setData] = useState<TransactionData | null>(null)
  const [config, setConfig] = useState<TransactionConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<TransactionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.transaction ?? false

  function onNewData(resp: TransactionData) {
    setData(resp)
    setConfig({
      ...resp.config,
      slowThresholdOverrides: resp.config.slowThresholdOverrides.map((o) => ({ ...o })),
    })
    setOriginalConfig({
      ...resp.config,
      slowThresholdOverrides: resp.config.slowThresholdOverrides.map((o) => ({ ...o })),
    })
  }

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const resp = await apiGet<TransactionData>('/backend/config/transaction', {
        'agent-id': agentId,
      })
      onNewData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  const hasChanges = config && originalConfig
    ? JSON.stringify(config) !== JSON.stringify(originalConfig)
    : false

  async function handleSave() {
    if (!agentId) return
    const resp = await apiPost<TransactionData>(
      '/backend/config/transaction?agent-id=' + encodeURIComponent(agentId),
      config
    )
    onNewData(resp)
  }

  function addOverride() {
    if (!config || !data) return
    setConfig({
      ...config,
      slowThresholdOverrides: [
        ...config.slowThresholdOverrides,
        {
          transactionType: data.defaultTransactionType,
          transactionName: '',
          user: '',
          thresholdMillis: null,
        },
      ],
    })
  }

  function removeOverride(index: number) {
    if (!config) return
    const updated = [...config.slowThresholdOverrides]
    updated.splice(index, 1)
    setConfig({ ...config, slowThresholdOverrides: updated })
  }

  function updateOverride(index: number, field: keyof SlowThresholdOverride, value: unknown) {
    if (!config) return
    const updated = [...config.slowThresholdOverrides]
    updated[index] = { ...updated[index], [field]: value }
    setConfig({ ...config, slowThresholdOverrides: updated })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!config || !data) return null

  return (
    <div className="rounded-lg border bg-white p-6">
      <GtFormGroup label="Slow threshold">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={config.slowThresholdMillis}
            onChange={(e) => setConfig({ ...config, slowThresholdMillis: parseInt(e.target.value) || 0 })}
            className="w-24"
            disabled={!canEdit}
          />
          <span className="text-sm text-gray-500">milliseconds</span>
        </div>
      </GtFormGroup>
      <GtFormGroup label="Profiling interval">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={config.profilingIntervalMillis}
            onChange={(e) => setConfig({ ...config, profilingIntervalMillis: parseInt(e.target.value) || 0 })}
            className="w-24"
            disabled={!canEdit}
          />
          <span className="text-sm text-gray-500">milliseconds</span>
        </div>
      </GtFormGroup>
      <GtFormGroup label="Thread stats">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={config.captureThreadStats}
            onCheckedChange={(c) => setConfig({ ...config, captureThreadStats: !!c })}
            disabled={!canEdit}
          />
          Capture JVM thread stats
        </label>
      </GtFormGroup>

      <div className="mt-6 border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Slow threshold overrides</h3>
        {config.slowThresholdOverrides.map((override, i) => (
          <div key={i} className="mb-4 rounded border p-4 bg-gray-50">
            <GtFormGroup label="Transaction type">
              <select
                value={override.transactionType}
                onChange={(e) => updateOverride(i, 'transactionType', e.target.value)}
                disabled={!canEdit}
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
              >
                {data.allTransactionTypes.map((tt) => (
                  <option key={tt} value={tt}>{tt}</option>
                ))}
              </select>
            </GtFormGroup>
            <GtFormGroup label="Transaction name">
              <Input
                value={override.transactionName}
                onChange={(e) => updateOverride(i, 'transactionName', e.target.value)}
                disabled={!canEdit}
              />
            </GtFormGroup>
            <GtFormGroup label="User">
              <Input
                value={override.user}
                onChange={(e) => updateOverride(i, 'user', e.target.value)}
                disabled={!canEdit}
              />
            </GtFormGroup>
            <GtFormGroup label="Slow threshold">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={override.thresholdMillis ?? ''}
                  onChange={(e) => updateOverride(i, 'thresholdMillis', parseInt(e.target.value) || null)}
                  className="w-24"
                  disabled={!canEdit}
                />
                <span className="text-sm text-gray-500">milliseconds</span>
              </div>
            </GtFormGroup>
            {canEdit && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeOverride(i)}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            )}
          </div>
        ))}
        {canEdit && (
          <Button variant="outline" size="sm" onClick={addOverride}>
            <Plus className="h-4 w-4" /> Add slow threshold override
          </Button>
        )}
      </div>

      {canEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}
    </div>
  )
}
