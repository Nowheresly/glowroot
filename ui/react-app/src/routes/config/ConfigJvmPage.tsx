import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface JvmConfig {
  maskSystemProperties: string[]
  maskMBeanAttributes: string[]
  version: string
}

export function ConfigJvmPage() {
  const { agentId, agentRollup } = useAgent()
  const [config, setConfig] = useState<JvmConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<JvmConfig | null>(null)
  // UI fields: comma-separated strings
  const [maskSysProps, setMaskSysProps] = useState('')
  const [maskMBeanAttrs, setMaskMBeanAttrs] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.jvm ?? false

  function splitItems(val: string): string[] {
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }

  function onNewData(data: JvmConfig) {
    setConfig({ ...data })
    setOriginalConfig({ ...data })
    setMaskSysProps(data.maskSystemProperties.join(', '))
    setMaskMBeanAttrs(data.maskMBeanAttributes.join(', '))
  }

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const resp = await apiGet<JvmConfig>('/backend/config/jvm', {
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

  function buildConfig(): JvmConfig {
    return {
      ...config!,
      maskSystemProperties: splitItems(maskSysProps),
      maskMBeanAttributes: splitItems(maskMBeanAttrs),
    }
  }

  const hasChanges = config && originalConfig
    ? JSON.stringify(buildConfig()) !== JSON.stringify(originalConfig)
    : false

  async function handleSave() {
    if (!agentId) return
    const resp = await apiPost<JvmConfig>(
      '/backend/config/jvm?agent-id=' + encodeURIComponent(agentId),
      buildConfig()
    )
    onNewData(resp)
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!config) return null

  return (
    <div className="rounded-lg border bg-white p-6">
      <GtFormGroup label="Mask system properties" helpText="Comma-separated list. Supports wildcard '*'.">
        <Input
          value={maskSysProps}
          onChange={(e) => setMaskSysProps(e.target.value)}
          disabled={!canEdit}
        />
      </GtFormGroup>
      <GtFormGroup label="Mask MBean attributes" helpText="Comma-separated list. Format: ObjectName:AttributeName.">
        <Input
          value={maskMBeanAttrs}
          onChange={(e) => setMaskMBeanAttrs(e.target.value)}
          disabled={!canEdit}
        />
      </GtFormGroup>
      {canEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}
    </div>
  )
}
