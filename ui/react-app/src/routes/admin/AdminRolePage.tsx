import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLayout } from '../../contexts/LayoutContext'
import { apiGet, apiPost, ApiError } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

const AGENT_PERMISSIONS = [
  { key: 'agent:transaction', label: 'Transaction (all)', children: [
    { key: 'agent:transaction:overview', label: 'Overview' },
    { key: 'agent:transaction:traces', label: 'Traces' },
    { key: 'agent:transaction:queries', label: 'Queries' },
    { key: 'agent:transaction:serviceCalls', label: 'Service calls' },
    { key: 'agent:transaction:threadProfile', label: 'Thread profile' },
  ]},
  { key: 'agent:error', label: 'Error (all)', children: [
    { key: 'agent:error:overview', label: 'Overview' },
    { key: 'agent:error:traces', label: 'Traces' },
  ]},
  { key: 'agent:jvm', label: 'JVM (all)', children: [
    { key: 'agent:jvm:gauges', label: 'Gauges' },
    { key: 'agent:jvm:threadDump', label: 'Thread dump' },
    { key: 'agent:jvm:heapDump', label: 'Heap dump' },
    { key: 'agent:jvm:heapHistogram', label: 'Heap histogram' },
    { key: 'agent:jvm:forceGC', label: 'Force GC' },
    { key: 'agent:jvm:mbeanTree', label: 'MBean tree' },
    { key: 'agent:jvm:systemProperties', label: 'System properties' },
    { key: 'agent:jvm:environment', label: 'Environment' },
  ]},
  { key: 'agent:syntheticMonitor', label: 'Synthetic monitor' },
  { key: 'agent:incident', label: 'Incident' },
  { key: 'agent:config', label: 'Config (all)', children: [
    { key: 'agent:config:view', label: 'View' },
    { key: 'agent:config:edit', label: 'Edit (all)', children: [
      { key: 'agent:config:edit:transaction', label: 'Transaction' },
      { key: 'agent:config:edit:gauges', label: 'Gauges' },
      { key: 'agent:config:edit:jvm', label: 'JVM' },
      { key: 'agent:config:edit:alerts', label: 'Alerts' },
      { key: 'agent:config:edit:uiDefaults', label: 'UI defaults' },
      { key: 'agent:config:edit:plugins', label: 'Plugins' },
      { key: 'agent:config:edit:instrumentation', label: 'Instrumentation' },
      { key: 'agent:config:edit:advanced', label: 'Advanced' },
    ]},
  ]},
]

const ADMIN_PERMISSIONS = [
  { key: 'admin', label: 'Admin (all)', children: [
    { key: 'admin:view', label: 'View' },
    { key: 'admin:edit', label: 'Edit' },
  ]},
  { key: 'report', label: 'Report' },
]

interface RoleConfig {
  name: string
  permissions: string[]
  version?: string
}

export function AdminRolePage() {
  const { layout } = useLayout()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isNew = searchParams.has('new')
  const nameParam = searchParams.get('name')

  const [config, setConfig] = useState<RoleConfig>({ name: '', permissions: [] })
  const [originalConfig, setOriginalConfig] = useState<RoleConfig>({ name: '', permissions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    try {
      if (isNew) {
        setConfig({ name: '', permissions: [] })
        setOriginalConfig({ name: '', permissions: [] })
      } else if (nameParam) {
        const resp = await apiGet<{ config: RoleConfig }>('/backend/admin/roles', { name: nameParam })
        setConfig({ ...resp.config })
        setOriginalConfig({ ...resp.config })
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [isNew, nameParam])

  useEffect(() => { load() }, [load])

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)

  function togglePermission(perm: string, checked: boolean) {
    let perms = [...config.permissions]
    if (checked) {
      perms.push(perm)
      // When parent permission is checked, remove child permissions
      perms = perms.filter((p) => !(p.startsWith(perm + ':') && p !== perm))
    } else {
      perms = perms.filter((p) => p !== perm)
    }
    setConfig({ ...config, permissions: perms.sort() })
  }

  function hasPermission(perm: string): boolean {
    return config.permissions.includes(perm)
  }

  function hasParentPermission(perm: string): boolean {
    // Check if any parent of this permission is in the list
    const parts = perm.split(':')
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join(':')
      if (config.permissions.includes(parent)) return true
    }
    return false
  }

  async function handleSave() {
    try {
      if (isNew) {
        const resp = await apiPost<{ config: RoleConfig }>('/backend/admin/roles/add', config)
        navigate(`/modern/admin/role?name=${encodeURIComponent(resp.config.name)}`, { replace: true })
        setConfig({ ...resp.config })
        setOriginalConfig({ ...resp.config })
      } else {
        const resp = await apiPost<{ config: RoleConfig }>('/backend/admin/roles/update', config)
        setConfig({ ...resp.config })
        setOriginalConfig({ ...resp.config })
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        throw new Error('Role name already exists')
      }
      throw e
    }
  }

  async function handleDelete() {
    await apiPost('/backend/admin/roles/remove', config)
    navigate('/modern/admin/role-list', { replace: true })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  function renderPermTree(
    items: typeof AGENT_PERMISSIONS,
    depth = 0
  ) {
    return items.map((item) => {
      const parentDisabled = hasParentPermission(item.key)
      return (
        <div key={item.key} style={{ marginLeft: depth * 20 }}>
          <label className="flex items-center gap-2 py-0.5 text-sm">
            <Checkbox
              checked={hasPermission(item.key) || parentDisabled}
              onCheckedChange={(c) => togglePermission(item.key, c)}
              disabled={!layout.adminEdit || parentDisabled}
            />
            {item.label}
          </label>
          {item.children && !hasPermission(item.key) && (
            renderPermTree(item.children, depth + 1)
          )}
        </div>
      )
    })
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <GtFormGroup label="Name">
        <Input
          value={config.name}
          onChange={(e) => setConfig({ ...config, name: e.target.value })}
          disabled={!isNew || !layout.adminEdit}
        />
      </GtFormGroup>

      <GtFormGroup label="Permissions">
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Agent permissions
          </h4>
          {renderPermTree(AGENT_PERMISSIONS)}
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">
            Admin permissions
          </h4>
          {renderPermTree(ADMIN_PERMISSIONS)}
        </div>
      </GtFormGroup>

      {layout.adminEdit && (
        <GtButtonGroup
          onSave={handleSave}
          hasChanges={hasChanges}
          saveLabel={isNew ? 'Add' : 'Save changes'}
          onDelete={!isNew && config.version !== undefined ? handleDelete : undefined}
          showDelete={!isNew && config.version !== undefined}
          deleteConfirmMessage={`Are you sure you want to delete role '${config.name}'?`}
        />
      )}
    </div>
  )
}
