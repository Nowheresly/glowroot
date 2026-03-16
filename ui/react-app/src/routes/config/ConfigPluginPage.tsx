import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface PluginProperty {
  name: string
  type: 'BOOLEAN' | 'DOUBLE' | 'STRING' | 'LIST'
  value: unknown
  label?: string
  checkboxLabel?: string
  description?: string
}

interface PluginConfig {
  name: string
  properties: PluginProperty[]
  version: string
}

export function ConfigPluginPage() {
  const { agentId, agentRollup } = useAgent()
  const [searchParams] = useSearchParams()
  const pluginId = searchParams.get('plugin-id')

  const [config, setConfig] = useState<PluginConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<PluginConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.plugins ?? false

  function onNewData(data: PluginConfig) {
    // For LIST properties, ensure there's an empty trailing item for adding
    const props = data.properties.map((p) => {
      if (p.type === 'LIST') {
        const list = [...(p.value as string[])]
        if (list.length === 0 || list[list.length - 1] !== '') {
          list.push('')
        }
        return { ...p, value: list }
      }
      return { ...p }
    })
    setConfig({ ...data, properties: props })
    setOriginalConfig({ ...data, properties: data.properties.map((p) => ({ ...p })) })
  }

  const load = useCallback(async () => {
    if (!agentId || !pluginId) return
    try {
      const resp = await apiGet<PluginConfig>('/backend/config/plugins', {
        'agent-id': agentId,
        'plugin-id': pluginId,
      })
      onNewData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId, pluginId])

  useEffect(() => { load() }, [load])

  function cleanProperties(): PluginProperty[] {
    if (!config) return []
    return config.properties.map((p) => {
      if (p.type === 'LIST') {
        const list = (p.value as string[]).map((s) => s.trim()).filter(Boolean)
        return { ...p, value: list }
      }
      return { ...p }
    })
  }

  function hasChanges(): boolean {
    if (!config || !originalConfig) return false
    const cleaned = cleanProperties()
    return JSON.stringify(cleaned) !== JSON.stringify(originalConfig.properties)
  }

  async function handleSave() {
    if (!agentId || !pluginId || !config) return
    const postData = {
      pluginId,
      properties: cleanProperties(),
      version: config.version,
    }
    const resp = await apiPost<PluginConfig & { firstInvalidRegularExpression?: string }>(
      '/backend/config/plugins?agent-id=' + encodeURIComponent(agentId),
      postData
    )
    if (resp.firstInvalidRegularExpression) {
      throw new Error(`Invalid regular expression: ${resp.firstInvalidRegularExpression}`)
    }
    onNewData(resp)
  }

  function updateProperty(index: number, value: unknown) {
    if (!config) return
    const updated = [...config.properties]
    updated[index] = { ...updated[index], value }
    // For LIST: ensure trailing empty item
    if (updated[index].type === 'LIST') {
      const list = value as string[]
      if (list.length === 0 || list[list.length - 1] !== '') {
        updated[index] = { ...updated[index], value: [...list, ''] }
      }
    }
    setConfig({ ...config, properties: updated })
  }

  function updateListItem(propIndex: number, itemIndex: number, value: string) {
    if (!config) return
    const list = [...(config.properties[propIndex].value as string[])]
    list[itemIndex] = value
    updateProperty(propIndex, list)
  }

  function removeListItem(propIndex: number, itemIndex: number) {
    if (!config) return
    const list = [...(config.properties[propIndex].value as string[])]
    list.splice(itemIndex, 1)
    updateProperty(propIndex, list)
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!config) return null

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{config.name}</h2>
      {config.properties.map((prop, i) => {
        if (prop.type === 'BOOLEAN') {
          return (
            <GtFormGroup key={prop.name} label={prop.label || prop.name}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={prop.value as boolean}
                  onCheckedChange={(c) => updateProperty(i, !!c)}
                  disabled={!canEdit}
                />
                {prop.checkboxLabel || ''}
              </label>
              {prop.description && (
                <p className="mt-1 text-xs text-gray-500">{prop.description}</p>
              )}
            </GtFormGroup>
          )
        }
        if (prop.type === 'DOUBLE' || prop.type === 'STRING') {
          return (
            <GtFormGroup key={prop.name} label={prop.label || prop.name}>
              <Input
                type={prop.type === 'DOUBLE' ? 'number' : 'text'}
                value={prop.value as string | number ?? ''}
                onChange={(e) => {
                  const val = prop.type === 'DOUBLE'
                    ? (e.target.value === '' ? null : parseFloat(e.target.value))
                    : e.target.value
                  updateProperty(i, val)
                }}
                disabled={!canEdit}
              />
              {prop.description && (
                <p className="mt-1 text-xs text-gray-500">{prop.description}</p>
              )}
            </GtFormGroup>
          )
        }
        if (prop.type === 'LIST') {
          const list = prop.value as string[]
          return (
            <GtFormGroup key={prop.name} label={prop.label || prop.name}>
              <div className="space-y-1">
                {list.map((item, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateListItem(i, j, e.target.value)}
                      disabled={!canEdit}
                    />
                    {j < list.length - 1 && canEdit && (
                      <button
                        type="button"
                        onClick={() => removeListItem(i, j)}
                        className="text-gray-400 hover:text-red-500 text-sm"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {prop.description && (
                <p className="mt-1 text-xs text-gray-500">{prop.description}</p>
              )}
            </GtFormGroup>
          )
        }
        return null
      })}
      {canEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges()} />
      )}
    </div>
  )
}
