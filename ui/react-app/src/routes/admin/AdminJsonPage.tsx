import { useCallback, useEffect, useState } from 'react'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

export function AdminJsonPage() {
  const [adminJson, setAdminJson] = useState('')
  const [originalAdminJson, setOriginalAdminJson] = useState('')
  const [configVersion, setConfigVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  function processRawJson(raw: string) {
    const stripped = raw.replace(/,\s*"version":\s*"[0-9a-f]{40}"/, '')
    setAdminJson(stripped)
    setOriginalAdminJson(stripped)
    setConfigVersion(JSON.parse(raw).version)
  }

  const load = useCallback(async () => {
    try {
      const response = await fetch('/backend/admin/json', { credentials: 'same-origin' })
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
  }, [])

  useEffect(() => { load() }, [load])

  const hasChanges = adminJson !== originalAdminJson

  async function handleSave() {
    let postData: Record<string, unknown>
    try {
      postData = JSON.parse(adminJson)
    } catch (e) {
      throw new Error('Invalid JSON: ' + (e instanceof Error ? e.message : String(e)))
    }
    postData.version = configVersion
    const response = await fetch('/backend/admin/json', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData),
    })
    if (!response.ok) {
      const errData = await response.json().catch(() => null)
      throw new Error(errData?.message || `HTTP ${response.status}`)
    }
    const raw = await response.text()
    processRawJson(raw)
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  const lines = Math.max((adminJson.match(/\n/g) || []).length + 1, 10)

  return (
    <div className="rounded-lg border bg-white p-6">
      <textarea
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        rows={lines}
        value={adminJson}
        onChange={(e) => setAdminJson(e.target.value)}
      />
      <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
    </div>
  )
}
