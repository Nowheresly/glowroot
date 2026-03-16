import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

const DEFAULT_JAVA_SOURCE = `import org.apache.http.impl.client.*;
import org.apache.http.client.methods.*;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;

import static org.openqa.selenium.support.ui.ExpectedConditions.*;

public class Example {

    public void test(CloseableHttpClient httpClient) throws Exception {
        // e.g.
        HttpGet request = new HttpGet("https://www.example.org");
        try (CloseableHttpResponse response = httpClient.execute(request)) {
            if (response.getStatusLine().getStatusCode() >= 400) {
                throw new Exception("Unexpected response status code: "
                        + response.getStatusLine().getStatusCode());
            }
        }
        // do not close the http client itself (it is re-used)
    }

    // ---- or ----

    public void test(WebDriver driver) throws Exception {
        // e.g.
        driver.get("https://www.example.org");
        new WebDriverWait(driver, 30).until(
                  visibilityOfElementLocated(By.xpath("//h1[text()='Example Domain']")));
        WebElement element = driver.findElement(By.linkText("More information..."));
        element.click();
        // ...
    }
}`

interface SyntheticMonitorConfig {
  id?: string
  display?: string
  kind: 'ping' | 'java'
  pingUrl?: string
  javaSource?: string
  version?: string
}

export function ConfigSyntheticMonitorPage() {
  const { agentRollupId, agentRollup, agentQueryString } = useAgent()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isNew = searchParams.has('new')
  const id = searchParams.get('id')

  const [config, setConfig] = useState<SyntheticMonitorConfig>({ kind: 'ping' })
  const [originalConfig, setOriginalConfig] = useState<SyntheticMonitorConfig>({ kind: 'ping' })
  const [compilationErrors, setCompilationErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.syntheticMonitors ?? false

  const load = useCallback(async () => {
    if (!agentRollupId) return
    try {
      if (isNew) {
        const newConfig: SyntheticMonitorConfig = { kind: 'ping' }
        setConfig(newConfig)
        setOriginalConfig({ ...newConfig })
      } else if (id) {
        const resp = await apiGet<SyntheticMonitorConfig>('/backend/config/synthetic-monitors', {
          'agent-rollup-id': agentRollupId,
          id,
        })
        setConfig({ ...resp })
        setOriginalConfig({ ...resp })
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentRollupId, isNew, id])

  useEffect(() => { load() }, [load])

  function handleKindChange(kind: 'ping' | 'java') {
    const updated: SyntheticMonitorConfig = { ...config, kind }
    delete updated.pingUrl
    delete updated.javaSource
    if (kind === 'java') {
      updated.javaSource = DEFAULT_JAVA_SOURCE
    }
    setConfig(updated)
  }

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)

  async function handleSave() {
    if (!agentRollupId) return
    const endpoint = isNew
      ? '/backend/config/synthetic-monitors/add'
      : '/backend/config/synthetic-monitors/update'
    const resp = await apiPost<SyntheticMonitorConfig & {
      symmetricEncryptionKeyMissing?: boolean
      javaSourceCompilationErrors?: string[]
    }>(
      endpoint + '?agent-rollup-id=' + encodeURIComponent(agentRollupId),
      config
    )
    if (resp.symmetricEncryptionKeyMissing) {
      throw new Error('cassandra.symmetricEncryptionKey must be configured in the glowroot-central.properties file before string constants beginning with the text "ENCRYPT:" can be encrypted')
    }
    if (resp.javaSourceCompilationErrors) {
      setCompilationErrors(resp.javaSourceCompilationErrors)
      throw new Error('Compile errors (see above)')
    }
    setCompilationErrors([])
    setConfig({ ...resp })
    setOriginalConfig({ ...resp })
    if (isNew) {
      const qs = agentQueryString()
      navigate(
        `/modern/config/synthetic-monitor${qs}${qs ? '&' : '?'}id=${encodeURIComponent(resp.id!)}`,
        { replace: true }
      )
    }
  }

  async function handleDelete() {
    if (!agentRollupId) return
    await apiPost(
      '/backend/config/synthetic-monitors/remove?agent-rollup-id=' + encodeURIComponent(agentRollupId),
      { id: config.id }
    )
    const qs = agentQueryString()
    navigate(`/modern/config/synthetic-monitor-list${qs}`, { replace: true })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  return (
    <div className="rounded-lg border bg-white p-6">
      <GtFormGroup label="Synthetic monitor type">
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="kind"
              value="ping"
              checked={config.kind === 'ping'}
              onChange={() => handleKindChange('ping')}
              disabled={!canEdit}
            />
            Ping
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="kind"
              value="java"
              checked={config.kind === 'java'}
              onChange={() => handleKindChange('java')}
              disabled={!canEdit}
            />
            Java
          </label>
        </div>
      </GtFormGroup>

      {config.kind === 'ping' && (
        <>
          <GtFormGroup label="Ping URL" helpText="The HTTP or HTTPS URL to ping with a simple GET request.">
            <Input
              value={config.pingUrl || ''}
              onChange={(e) => setConfig({ ...config, pingUrl: e.target.value })}
              disabled={!canEdit}
              placeholder="https://www.example.org"
            />
          </GtFormGroup>
          <GtFormGroup label="Display name" helpText="Display name for this synthetic monitor.">
            <Input
              value={config.display || ''}
              onChange={(e) => setConfig({ ...config, display: e.target.value })}
              disabled={!canEdit}
              placeholder={config.pingUrl ? `Ping ${config.pingUrl}` : 'Ping <url>'}
            />
          </GtFormGroup>
          {isNew && (
            <GtFormGroup label="ID" helpText="ID for this synthetic monitor. Auto-generated on creation if left blank.">
              <Input
                value={config.id || ''}
                onChange={(e) => setConfig({ ...config, id: e.target.value })}
                disabled={!canEdit}
              />
            </GtFormGroup>
          )}
        </>
      )}

      {config.kind === 'java' && (
        <>
          <GtFormGroup label="Display name" helpText="Display name for this synthetic monitor.">
            <Input
              value={config.display || ''}
              onChange={(e) => setConfig({ ...config, display: e.target.value })}
              disabled={!canEdit}
            />
          </GtFormGroup>
          <GtFormGroup label="Java source" helpText="A Java class that executes the synthetic monitor.">
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              rows={20}
              value={config.javaSource || ''}
              onChange={(e) => setConfig({ ...config, javaSource: e.target.value })}
              disabled={!canEdit}
            />
            {compilationErrors.length > 0 && (
              <div className="mt-2 space-y-1">
                {compilationErrors.map((err, i) => (
                  <p key={i} className="text-sm font-medium text-red-600">{err}</p>
                ))}
              </div>
            )}
          </GtFormGroup>
        </>
      )}

      {canEdit && (
        <GtButtonGroup
          onSave={handleSave}
          hasChanges={hasChanges}
          saveLabel={isNew ? 'Add' : 'Save changes'}
          onDelete={!isNew && config.id ? handleDelete : undefined}
          showDelete={!isNew && !!config.id}
          deleteConfirmMessage="Are you sure you want to delete this synthetic monitor?"
        />
      )}
    </div>
  )
}
