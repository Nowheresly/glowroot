import { useCallback, useEffect, useState } from 'react'
import { useLayout } from '../../contexts/LayoutContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface StorageConfig {
  rollupExpirationHours: number[]
  rollupCappedDatabaseSizesMb?: number[]
  traceCappedDatabaseSizeMb?: number
  traceExpirationHours?: number
  fullQueryTextExpirationHours?: number
  queryAndServiceCallRollupExpirationHours?: number[]
  profileRollupExpirationHours?: number[]
  version?: string
}

export function AdminStoragePage() {
  const { layout } = useLayout()
  const [config, setConfig] = useState<StorageConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<StorageConfig | null>(null)
  // UI state in days (API uses hours)
  const [rollupDays, setRollupDays] = useState<number[]>([])
  const [traceDays, setTraceDays] = useState(0)
  const [fullQueryDays, setFullQueryDays] = useState(0)
  const [queryRollupDays, setQueryRollupDays] = useState<number[]>([])
  const [profileRollupDays, setProfileRollupDays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  function onNewData(c: StorageConfig) {
    setConfig({ ...c })
    setOriginalConfig({ ...c })
    setRollupDays(c.rollupExpirationHours.map((h) => h / 24))
    setTraceDays((c.traceExpirationHours ?? 0) / 24)
    setFullQueryDays((c.fullQueryTextExpirationHours ?? 0) / 24)
    setQueryRollupDays((c.queryAndServiceCallRollupExpirationHours ?? []).map((h) => h / 24))
    setProfileRollupDays((c.profileRollupExpirationHours ?? []).map((h) => h / 24))
  }

  const load = useCallback(async () => {
    try {
      const resp = await apiGet<StorageConfig>('/backend/admin/storage')
      onNewData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function buildConfigFromUi(): StorageConfig {
    const result: StorageConfig = {
      ...config!,
      rollupExpirationHours: rollupDays.map((d) => d * 24),
      traceExpirationHours: traceDays * 24,
    }
    if (layout.central) {
      result.queryAndServiceCallRollupExpirationHours = queryRollupDays.map((d) => d * 24)
      result.profileRollupExpirationHours = profileRollupDays.map((d) => d * 24)
    } else {
      result.fullQueryTextExpirationHours = fullQueryDays * 24
    }
    return result
  }

  const hasChanges = config
    ? JSON.stringify(buildConfigFromUi()) !== JSON.stringify(originalConfig)
    : false

  async function handleSave() {
    const updated = buildConfigFromUi()
    const resp = await apiPost<StorageConfig>('/backend/admin/storage', updated)
    onNewData(resp)
  }

  async function runAction(endpoint: string, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return
    setActionLoading(endpoint)
    setActionMessage(null)
    try {
      await apiPost(endpoint)
      setActionMessage({ type: 'success', text: 'Completed' })
    } catch (e) {
      setActionMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setActionLoading(null)
    }
  }

  function updateRollupDay(index: number, value: number) {
    const updated = [...rollupDays]
    updated[index] = value
    setRollupDays(updated)
  }

  function updateCappedSize(index: number, value: number) {
    if (!config) return
    const updated = [...(config.rollupCappedDatabaseSizesMb ?? [])]
    updated[index] = value
    setConfig({ ...config, rollupCappedDatabaseSizesMb: updated })
  }

  function updateQueryRollupDay(index: number, value: number) {
    const updated = [...queryRollupDays]
    updated[index] = value
    setQueryRollupDays(updated)
  }

  function updateProfileRollupDay(index: number, value: number) {
    const updated = [...profileRollupDays]
    updated[index] = value
    setProfileRollupDays(updated)
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!config) return null

  const rollupLabels = ['1-minute', '5-minute', '30-minute', '4-hour']

  return (
    <div className="space-y-6">
      {/* Aggregate data */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          {layout.central ? 'Response time and JVM gauge data' : 'Aggregate data (data.mv.db)'}
        </h3>
        {rollupDays.map((days, i) => (
          <GtFormGroup key={i} label={`${rollupLabels[i]} aggregates`}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={days}
                onChange={(e) => updateRollupDay(i, parseFloat(e.target.value) || 0)}
                className="w-24"
                disabled={!layout.adminEdit}
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </GtFormGroup>
        ))}

        {layout.central && queryRollupDays.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mt-6 mb-4">
              Query and service call data
            </h3>
            {queryRollupDays.map((days, i) => (
              <GtFormGroup key={i} label={`${rollupLabels[i]} aggregates`}>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={days}
                    onChange={(e) => updateQueryRollupDay(i, parseFloat(e.target.value) || 0)}
                    className="w-24"
                    disabled={!layout.adminEdit}
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </GtFormGroup>
            ))}
          </>
        )}

        {layout.central && profileRollupDays.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mt-6 mb-4">
              Profile data
            </h3>
            {profileRollupDays.map((days, i) => (
              <GtFormGroup key={i} label={`${rollupLabels[i]} aggregates`}>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={days}
                    onChange={(e) => updateProfileRollupDay(i, parseFloat(e.target.value) || 0)}
                    className="w-24"
                    disabled={!layout.adminEdit}
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </GtFormGroup>
            ))}
          </>
        )}

        <GtFormGroup label="Trace data">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={traceDays}
              onChange={(e) => setTraceDays(parseFloat(e.target.value) || 0)}
              className="w-24"
              disabled={!layout.adminEdit}
            />
            <span className="text-sm text-gray-500">days</span>
          </div>
        </GtFormGroup>

        {!layout.central && (
          <GtFormGroup label="Full query text">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={fullQueryDays}
                onChange={(e) => setFullQueryDays(parseFloat(e.target.value) || 0)}
                className="w-24"
                disabled={!layout.adminEdit}
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </GtFormGroup>
        )}

        {layout.adminEdit && (
          <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
        )}
      </div>

      {/* Capped database sizes (embedded only) */}
      {!layout.central && config.rollupCappedDatabaseSizesMb && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Capped database sizes (*.capped.db)</h3>
          {config.rollupCappedDatabaseSizesMb.map((size, i) => (
            <GtFormGroup key={i} label={`${rollupLabels[i]} aggregates`}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={size}
                  onChange={(e) => updateCappedSize(i, parseFloat(e.target.value) || 0)}
                  className="w-24"
                  disabled={!layout.adminEdit}
                />
                <span className="text-sm text-gray-500">MB</span>
              </div>
            </GtFormGroup>
          ))}
          <GtFormGroup label="Trace detail">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.traceCappedDatabaseSizeMb ?? 0}
                onChange={(e) =>
                  setConfig({ ...config, traceCappedDatabaseSizeMb: parseFloat(e.target.value) || 0 })
                }
                className="w-24"
                disabled={!layout.adminEdit}
              />
              <span className="text-sm text-gray-500">MB</span>
            </div>
          </GtFormGroup>
        </div>
      )}

      {/* Actions */}
      {layout.adminEdit && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions</h3>
          <div className="flex flex-wrap gap-3">
            {layout.central && (
              <Button
                variant="secondary"
                onClick={() => runAction('/backend/admin/update-cassandra-twcs-window-sizes',
                  'This could trigger a lot of window major compactions. Are you sure?')}
                loading={actionLoading === '/backend/admin/update-cassandra-twcs-window-sizes'}
              >
                Update TWCS window sizes
              </Button>
            )}
            {!layout.central && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => runAction('/backend/admin/defrag-h2-data',
                    'This could take several minutes during which time Glowroot will not capture any new data. Continue?')}
                  loading={actionLoading === '/backend/admin/defrag-h2-data'}
                >
                  Defrag H2 data
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => runAction('/backend/admin/compact-h2-data',
                    'This could take several minutes during which time Glowroot will not capture any new data. Continue?')}
                  loading={actionLoading === '/backend/admin/compact-h2-data'}
                >
                  Compact H2 data
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => runAction('/backend/admin/analyze-h2-disk-space',
                    'This could take several minutes during which time Glowroot data capture will be impacted. Continue?')}
                  loading={actionLoading === '/backend/admin/analyze-h2-disk-space'}
                >
                  Analyze H2 disk space
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => runAction('/backend/admin/analyze-trace-counts',
                    'This could take several minutes during which time Glowroot data capture will be impacted. Continue?')}
                  loading={actionLoading === '/backend/admin/analyze-trace-counts'}
                >
                  Analyze trace counts
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => runAction('/backend/admin/delete-all-stored-data',
                    'This will delete all captured data, including aggregated transaction data, traces and gauge data. Are you sure?')}
                  loading={actionLoading === '/backend/admin/delete-all-stored-data'}
                >
                  Delete all data
                </Button>
              </>
            )}
          </div>
          {actionMessage && (
            <p className={`mt-3 text-sm font-medium ${actionMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {actionMessage.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
