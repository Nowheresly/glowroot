import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost, ApiError } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface MBeanAttribute {
  name: string
  counter: boolean
}

interface GaugeConfig {
  display?: string
  displayPath?: string[]
  mbeanObjectName: string
  mbeanAttributes: MBeanAttribute[]
  version?: string
}

interface GaugeData {
  config: GaugeConfig
  agentNotConnected?: boolean
  noMatchFoundForPattern?: boolean
  noMatchFoundForNonPattern?: boolean
  mbeanAvailableAttributeNames?: string[]
}

interface AttributeState {
  name: string
  counter: boolean
  checked: boolean
  available: boolean
}

export function ConfigGaugePage() {
  const { agentId, agentRollup } = useAgent()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isNew = searchParams.has('new')
  const version = searchParams.get('v')

  const [config, setConfig] = useState<GaugeConfig>({ mbeanObjectName: '', mbeanAttributes: [] })
  const [originalConfig, setOriginalConfig] = useState<GaugeConfig>({ mbeanObjectName: '', mbeanAttributes: [] })
  const [allAttributes, setAllAttributes] = useState<AttributeState[]>([])
  const [agentNotConnected, setAgentNotConnected] = useState(false)
  const [noMatchForPattern, setNoMatchForPattern] = useState(false)
  const [noMatchForNonPattern, setNoMatchForNonPattern] = useState(false)
  const [duplicateMBean, setDuplicateMBean] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.gauges ?? false

  function buildAttributeStates(
    configAttrs: MBeanAttribute[],
    availableNames?: string[]
  ): AttributeState[] {
    const result: AttributeState[] = []
    const availableSet = new Set(availableNames || [])
    // Available attributes first
    for (const name of availableNames || []) {
      const existing = configAttrs.find((a) => a.name === name)
      result.push({
        name,
        counter: existing?.counter ?? false,
        checked: !!existing,
        available: true,
      })
    }
    // Then config attributes not in available list
    for (const attr of configAttrs) {
      if (!availableSet.has(attr.name)) {
        result.push({
          name: attr.name,
          counter: attr.counter,
          checked: true,
          available: false,
        })
      }
    }
    return result
  }

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      if (isNew) {
        const connected = await apiGet<boolean>('/backend/config/new-gauge-check-agent-connected', {
          'agent-id': agentId,
        })
        setAgentNotConnected(!connected)
        setConfig({ mbeanObjectName: '', mbeanAttributes: [] })
        setOriginalConfig({ mbeanObjectName: '', mbeanAttributes: [] })
      } else if (version) {
        const resp = await apiGet<GaugeData>('/backend/config/gauges', {
          'agent-id': agentId,
          version,
        })
        setConfig({ ...resp.config })
        setOriginalConfig({ ...resp.config })
        setAgentNotConnected(!!resp.agentNotConnected)
        setNoMatchForPattern(!!resp.noMatchFoundForPattern)
        setNoMatchForNonPattern(!!resp.noMatchFoundForNonPattern)
        setAllAttributes(
          buildAttributeStates(resp.config.mbeanAttributes, resp.mbeanAvailableAttributeNames)
        )
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId, isNew, version])

  useEffect(() => { load() }, [load])

  async function fetchAttributes(mbeanObjectName: string) {
    if (!agentId || !mbeanObjectName) return
    try {
      const resp = await apiGet<{
        noMatchFoundForPattern?: boolean
        noMatchFoundForNonPattern?: boolean
        duplicateMBean?: boolean
        mbeanAttributes?: string[]
      }>('/backend/config/mbean-attributes', {
        agentId,
        objectName: mbeanObjectName,
        gaugeVersion: config.version || '',
      })
      setNoMatchForPattern(!!resp.noMatchFoundForPattern)
      setNoMatchForNonPattern(!!resp.noMatchFoundForNonPattern)
      setDuplicateMBean(!!resp.duplicateMBean)
      if (resp.mbeanAttributes) {
        setAllAttributes(
          buildAttributeStates(config.mbeanAttributes, resp.mbeanAttributes)
        )
      }
    } catch {
      // ignore
    }
  }

  function toggleAttribute(index: number, checked: boolean) {
    const updated = [...allAttributes]
    updated[index] = { ...updated[index], checked }
    setAllAttributes(updated)
    // Sync back to config
    const attrs = updated
      .filter((a) => a.checked)
      .map((a) => ({ name: a.name, counter: a.counter }))
      .sort((a, b) => a.name.localeCompare(b.name))
    setConfig({ ...config, mbeanAttributes: attrs })
  }

  function toggleCounter(index: number, counter: boolean) {
    const updated = [...allAttributes]
    updated[index] = { ...updated[index], counter }
    setAllAttributes(updated)
    const attrs = updated
      .filter((a) => a.checked)
      .map((a) => ({ name: a.name, counter: a.counter }))
      .sort((a, b) => a.name.localeCompare(b.name))
    setConfig({ ...config, mbeanAttributes: attrs })
  }

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)

  async function handleSave() {
    if (!agentId) return
    try {
      const endpoint = isNew
        ? '/backend/config/gauges/add'
        : '/backend/config/gauges/update'
      const resp = await apiPost<GaugeData>(
        endpoint + '?agent-id=' + encodeURIComponent(agentId),
        config
      )
      if (isNew) {
        navigate(
          `/modern/config/gauge?agent-id=${encodeURIComponent(agentId)}&v=${encodeURIComponent(resp.config.version!)}`,
          { replace: true }
        )
      }
      setConfig({ ...resp.config })
      setOriginalConfig({ ...resp.config })
      setAllAttributes(
        buildAttributeStates(resp.config.mbeanAttributes, resp.mbeanAvailableAttributeNames)
      )
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDuplicateMBean(true)
        throw new Error('A gauge already exists for this MBean')
      }
      throw e
    }
  }

  async function handleDelete() {
    if (!agentId) return
    await apiPost(
      '/backend/config/gauges/remove?agent-id=' + encodeURIComponent(agentId),
      { version: config.version }
    )
    navigate(`/modern/config/gauge-list?agent-id=${encodeURIComponent(agentId)}`, { replace: true })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  return (
    <div className="rounded-lg border bg-white p-6">
      {agentNotConnected && (
        <p className="mb-4 text-sm text-amber-600">
          Agent is not connected. MBean auto-completion and attribute discovery are not available.
        </p>
      )}

      <GtFormGroup label="MBean object name">
        <Input
          value={config.mbeanObjectName}
          onChange={(e) => setConfig({ ...config, mbeanObjectName: e.target.value })}
          onBlur={() => fetchAttributes(config.mbeanObjectName)}
          disabled={!canEdit}
          placeholder="e.g. java.lang:type=Memory"
        />
        {noMatchForPattern && (
          <p className="mt-1 text-xs text-amber-600">No MBeans matching this pattern were found</p>
        )}
        {noMatchForNonPattern && (
          <p className="mt-1 text-xs text-amber-600">This MBean was not found</p>
        )}
        {duplicateMBean && (
          <p className="mt-1 text-xs text-red-600">A gauge already exists for this MBean</p>
        )}
      </GtFormGroup>

      {allAttributes.length > 0 && (
        <GtFormGroup label="MBean attributes">
          <div className="space-y-2">
            {allAttributes.map((attr, i) => (
              <div key={attr.name} className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm min-w-0 flex-1">
                  <Checkbox
                    checked={attr.checked}
                    onCheckedChange={(c) => toggleAttribute(i, !!c)}
                    disabled={!canEdit}
                  />
                  <span className={attr.available ? '' : 'text-gray-400'}>
                    {attr.name}
                    {!attr.available && ' (not available)'}
                  </span>
                </label>
                {attr.checked && (
                  <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <Checkbox
                      checked={attr.counter}
                      onCheckedChange={(c) => toggleCounter(i, !!c)}
                      disabled={!canEdit}
                    />
                    counter
                  </label>
                )}
              </div>
            ))}
          </div>
        </GtFormGroup>
      )}

      {canEdit && (
        <GtButtonGroup
          onSave={handleSave}
          hasChanges={hasChanges}
          saveLabel={isNew ? 'Add' : 'Save changes'}
          onDelete={!isNew && config.version ? handleDelete : undefined}
          showDelete={!isNew && !!config.version}
          deleteConfirmMessage="Are you sure you want to delete this gauge?"
        />
      )}
    </div>
  )
}
