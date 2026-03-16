import { useCallback, useEffect, useState } from 'react'
import { useLayout } from '../../contexts/LayoutContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface WebConfig {
  port?: number
  bindAddress?: string
  https?: boolean
  contextPath?: string
  sessionTimeoutMinutes?: number
  sessionCookieName?: string
  version?: string
}

interface WebData {
  config: WebConfig
  activePort?: number
  activeBindAddress?: string
  activeHttps?: boolean
  portReadOnly?: boolean
}

export function AdminWebPage() {
  const { layout } = useLayout()
  const [data, setData] = useState<WebData | null>(null)
  const [config, setConfig] = useState<WebConfig>({})
  const [originalConfig, setOriginalConfig] = useState<WebConfig>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    try {
      const resp = await apiGet<WebData>('/backend/admin/web')
      setData(resp)
      setConfig({ ...resp.config })
      setOriginalConfig({ ...resp.config })
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)

  async function handleSave() {
    const resp = await apiPost<WebData>('/backend/admin/web', config)
    // If port or https changed, redirect to new URL
    if (
      !layout.central &&
      (resp.config.port !== data?.activePort || resp.config.https !== data?.activeHttps)
    ) {
      const protocol = resp.activeHttps ? 'https' : 'http'
      const newUrl = `${protocol}://${window.location.hostname}:${resp.activePort}/modern/admin/web`
      setTimeout(() => {
        window.location.href = newUrl
      }, 500)
      return
    }
    setData(resp)
    setConfig({ ...resp.config })
    setOriginalConfig({ ...resp.config })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!data) return null

  return (
    <div className="rounded-lg border bg-white p-6">
      {!layout.central && (
        <>
          <GtFormGroup label="Port">
            <Input
              type="number"
              value={config.port ?? ''}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || undefined })}
              disabled={!layout.adminEdit || data.portReadOnly}
            />
            {config.port !== data.activePort && data.activePort !== undefined && (
              <p className="mt-1 text-xs text-amber-600">
                Active port is {data.activePort} (JVM restart required)
              </p>
            )}
          </GtFormGroup>

          <GtFormGroup label="Bind address">
            <Input
              value={config.bindAddress ?? ''}
              onChange={(e) => setConfig({ ...config, bindAddress: e.target.value })}
              disabled={!layout.adminEdit}
            />
            {config.bindAddress !== data.activeBindAddress && data.activeBindAddress !== undefined && (
              <p className="mt-1 text-xs text-amber-600">
                Active bind address is {data.activeBindAddress} (JVM restart required)
              </p>
            )}
          </GtFormGroup>

          <GtFormGroup label="HTTPS">
            <Checkbox
              checked={config.https ?? false}
              onCheckedChange={(checked) => setConfig({ ...config, https: checked })}
              disabled={!layout.adminEdit}
            />
            {config.https !== data.activeHttps && data.activeHttps !== undefined && (
              <p className="mt-1 text-xs text-amber-600">
                Active value is {data.activeHttps ? 'on' : 'off'} (change will take effect on save)
              </p>
            )}
          </GtFormGroup>

          <GtFormGroup label="Context path">
            <Input
              value={config.contextPath ?? ''}
              onChange={(e) => setConfig({ ...config, contextPath: e.target.value })}
              disabled={!layout.adminEdit}
            />
          </GtFormGroup>
        </>
      )}

      <GtFormGroup label="Session timeout (minutes)">
        <Input
          type="number"
          value={config.sessionTimeoutMinutes ?? ''}
          onChange={(e) => setConfig({ ...config, sessionTimeoutMinutes: parseInt(e.target.value) || undefined })}
          disabled={!layout.adminEdit || !layout.loginEnabled}
        />
      </GtFormGroup>

      <GtFormGroup label="Session cookie name">
        <Input
          value={config.sessionCookieName ?? ''}
          onChange={(e) => setConfig({ ...config, sessionCookieName: e.target.value })}
          disabled={!layout.adminEdit || !layout.loginEnabled}
        />
      </GtFormGroup>

      {layout.adminEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}
    </div>
  )
}
