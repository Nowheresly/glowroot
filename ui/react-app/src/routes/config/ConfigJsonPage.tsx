import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

export function ConfigJsonPage() {
  const { agentId, agentRollup } = useAgent()
  const [configJson, setConfigJson] = useState('')
  const [originalConfigJson, setOriginalConfigJson] = useState('')
  const [configVersion, setConfigVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const canEdit = agentRollup?.permissions?.config?.edit?.advanced ?? false

  function processRawJson(raw: string) {
    // Strip version from display JSON
    const stripped = raw.replace(/,\s*"version":\s*"[0-9a-f]{40}"/, '')
    setConfigJson(stripped)
    setOriginalConfigJson(stripped)
    setConfigVersion(JSON.parse(raw).version)
  }

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const response = await fetch(
        `/backend/config/json?agent-id=${encodeURIComponent(agentId)}`,
        { credentials: 'same-origin' }
      )
      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.message || `HTTP ${response.status}`)
      }
      const raw = await response.text()
      processRawJson(raw)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  const hasChanges = configJson !== originalConfigJson

  async function handleSave() {
    if (!agentId) return
    let postData: Record<string, unknown>
    try {
      postData = JSON.parse(configJson)
    } catch (e) {
      throw new Error('Invalid JSON: ' + (e instanceof Error ? e.message : String(e)))
    }
    // Put back version
    postData.version = configVersion
    const response = await fetch(
      `/backend/config/json?agent-id=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      }
    )
    if (!response.ok) {
      const errData = await response.json().catch(() => null)
      throw new Error(errData?.message || `HTTP ${response.status}`)
    }
    const raw = await response.text()
    processRawJson(raw)
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  const lines = Math.max((configJson.match(/\n/g) || []).length + 1, 10)

  return (
    <div className="rounded-lg border bg-white p-6">
      <textarea
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        rows={lines}
        value={configJson}
        onChange={(e) => setConfigJson(e.target.value)}
        disabled={!canEdit}
      />
      {canEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}
    </div>
  )
}
