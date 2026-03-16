import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface UiDefaultsConfig {
  defaultTransactionType: string
  defaultPercentiles: number[]
  defaultGaugeNames: string[]
  version: string
}

interface Gauge {
  name: string
  display: string
  disabled?: boolean
}

interface UiDefaultsData {
  config: UiDefaultsConfig
  allTransactionTypes: string[]
  allGauges: Gauge[]
}

export function ConfigUiDefaultsPage() {
  const { agentRollupId, agentRollup } = useAgent()
  const [data, setData] = useState<UiDefaultsData | null>(null)
  const [config, setConfig] = useState<UiDefaultsConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<UiDefaultsConfig | null>(null)
  const [percentilesStr, setPercentilesStr] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.uiDefaults ?? false

  function onNewData(resp: UiDefaultsData) {
    // Add any missing gauge names that the config references
    const allGaugeNames = resp.allGauges.map((g) => g.name)
    const allGauges = [...resp.allGauges]
    for (const name of resp.config.defaultGaugeNames) {
      if (!allGaugeNames.includes(name)) {
        allGauges.push({ name, display: name + ' (not available)', disabled: true })
      }
    }
    // Add any missing transaction types
    const allTransactionTypes = [...resp.allTransactionTypes]
    if (!allTransactionTypes.includes(resp.config.defaultTransactionType)) {
      allTransactionTypes.push(resp.config.defaultTransactionType)
    }
    setData({ ...resp, allGauges, allTransactionTypes })
    setConfig({ ...resp.config, defaultGaugeNames: [...resp.config.defaultGaugeNames] })
    setOriginalConfig({ ...resp.config, defaultGaugeNames: [...resp.config.defaultGaugeNames] })
    setPercentilesStr(resp.config.defaultPercentiles.join(', '))
  }

  const load = useCallback(async () => {
    if (!agentRollupId) return
    try {
      const resp = await apiGet<UiDefaultsData>('/backend/config/ui-defaults', {
        'agent-rollup-id': agentRollupId,
      })
      onNewData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentRollupId])

  useEffect(() => { load() }, [load])

  function buildConfig(): UiDefaultsConfig {
    const percentiles = percentilesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n))
    return { ...config!, defaultPercentiles: percentiles }
  }

  const hasChanges = config && originalConfig
    ? JSON.stringify(buildConfig()) !== JSON.stringify(originalConfig)
    : false

  async function handleSave() {
    if (!agentRollupId) return
    const resp = await apiPost<UiDefaultsData>(
      '/backend/config/ui-defaults?agent-rollup-id=' + encodeURIComponent(agentRollupId),
      buildConfig()
    )
    onNewData(resp)
  }

  function toggleGauge(name: string, checked: boolean) {
    if (!config) return
    const names = checked
      ? [...config.defaultGaugeNames, name]
      : config.defaultGaugeNames.filter((n) => n !== name)
    setConfig({ ...config, defaultGaugeNames: names })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!config || !data) return null

  return (
    <div className="rounded-lg border bg-white p-6">
      <GtFormGroup label="Default transaction type">
        <select
          value={config.defaultTransactionType}
          onChange={(e) => setConfig({ ...config, defaultTransactionType: e.target.value })}
          disabled={!canEdit}
          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
        >
          {data.allTransactionTypes.map((tt) => (
            <option key={tt} value={tt}>{tt}</option>
          ))}
        </select>
      </GtFormGroup>
      <GtFormGroup label="Default percentiles" helpText="Comma-separated list of percentiles.">
        <Input
          value={percentilesStr}
          onChange={(e) => setPercentilesStr(e.target.value)}
          disabled={!canEdit}
        />
      </GtFormGroup>
      <GtFormGroup label="Default gauges">
        <div className="max-h-52 overflow-y-auto rounded border p-2 space-y-1">
          {data.allGauges.map((gauge) => (
            <label key={gauge.name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.defaultGaugeNames.includes(gauge.name)}
                onChange={(e) => toggleGauge(gauge.name, e.target.checked)}
                disabled={!canEdit}
              />
              <span className={gauge.disabled ? 'text-gray-400' : ''}>{gauge.display}</span>
            </label>
          ))}
        </div>
      </GtFormGroup>
      {canEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}
    </div>
  )
}
