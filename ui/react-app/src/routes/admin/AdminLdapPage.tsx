import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useLayout } from '../../contexts/LayoutContext'
import { apiGet, apiPost } from '../../lib/api'
import { GtFormGroup } from '../../components/shared/GtFormGroup'
import { GtButtonGroup } from '../../components/shared/GtButtonGroup'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface RoleMapping {
  ldapGroupDn: string
  glowrootRoles: string[]
}

interface LdapConfig {
  host?: string
  port?: number
  ssl?: boolean
  username?: string
  passwordExists?: boolean
  newPassword?: string
  userBaseDn?: string
  userSearchFilter?: string
  groupBaseDn?: string
  groupSearchFilter?: string
  roleMappings?: Record<string, string[]>
  version?: string
}

interface LdapData {
  config: LdapConfig
  allGlowrootRoles?: string[]
}

function mapToBlocks(roleMappings?: Record<string, string[]>): RoleMapping[] {
  if (!roleMappings) return []
  return Object.entries(roleMappings).map(([ldapGroupDn, glowrootRoles]) => ({
    ldapGroupDn,
    glowrootRoles: [...glowrootRoles],
  }))
}

function blocksToMap(blocks: RoleMapping[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const block of blocks) {
    map[block.ldapGroupDn] = block.glowrootRoles
  }
  return map
}

export function AdminLdapPage() {
  const { layout } = useLayout()
  const [config, setConfig] = useState<LdapConfig>({})
  const [originalConfig, setOriginalConfig] = useState<LdapConfig>({})
  const [roleMappingBlocks, setRoleMappingBlocks] = useState<RoleMapping[]>([])
  const [originalRoleMappingBlocks, setOriginalRoleMappingBlocks] = useState<RoleMapping[]>([])
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [testUsername, setTestUsername] = useState('')
  const [testPassword, setTestPassword] = useState('')
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  function onNewData(resp: LdapData) {
    setConfig({ ...resp.config })
    setOriginalConfig({ ...resp.config })
    const blocks = mapToBlocks(resp.config.roleMappings)
    setRoleMappingBlocks(blocks)
    setOriginalRoleMappingBlocks(blocks.map(b => ({ ...b, glowrootRoles: [...b.glowrootRoles] })))
    setPassword(resp.config.passwordExists ? '********' : '')
  }

  const load = useCallback(async () => {
    try {
      const resp = await apiGet<LdapData>('/backend/admin/ldap')
      onNewData(resp)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)
    || JSON.stringify(roleMappingBlocks) !== JSON.stringify(originalRoleMappingBlocks)

  function handlePasswordChange(value: string) {
    setPassword(value)
    setConfig({ ...config, newPassword: value, passwordExists: value !== '' })
  }

  async function handleSave() {
    const postData = { ...config, roleMappings: blocksToMap(roleMappingBlocks) }
    const resp = await apiPost<LdapData>('/backend/admin/ldap', postData)
    onNewData(resp)
  }

  function addRoleMapping() {
    setRoleMappingBlocks([...roleMappingBlocks, { ldapGroupDn: '', glowrootRoles: [] }])
  }

  function removeRoleMapping(index: number) {
    const updated = [...roleMappingBlocks]
    updated.splice(index, 1)
    setRoleMappingBlocks(updated)
  }

  function updateRoleMapping(index: number, field: keyof RoleMapping, value: string | string[]) {
    const updated = [...roleMappingBlocks]
    updated[index] = { ...updated[index], [field]: value }
    setRoleMappingBlocks(updated)
  }

  async function handleTest() {
    if (!testUsername) return
    setTesting(true)
    setTestResult(null)
    try {
      const postData = { ...config, roleMappings: blocksToMap(roleMappingBlocks), authTestUsername: testUsername, authTestPassword: testPassword }
      const resp = await apiPost<{
        error?: boolean
        message?: string
        glowrootRoles?: string[]
        ldapGroupDns?: string[]
      }>('/backend/admin/test-ldap', postData)
      if (resp.error) {
        setTestResult({ type: 'error', text: resp.message || 'Test failed' })
      } else {
        const roles = resp.glowrootRoles?.join(', ') || 'none'
        const groups = resp.ldapGroupDns?.join(', ') || 'none'
        setTestResult({
          type: 'success',
          text: `Glowroot roles: ${roles}\nLDAP groups: ${groups}`,
        })
      }
    } catch (e) {
      setTestResult({ type: 'error', text: e instanceof Error ? e.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Connection</h3>
        <GtFormGroup label="Host">
          <Input value={config.host ?? ''} onChange={(e) => setConfig({ ...config, host: e.target.value })} disabled={!layout.adminEdit} />
        </GtFormGroup>
        <GtFormGroup label="Port">
          <Input type="number" value={config.port ?? ''} onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || undefined })} disabled={!layout.adminEdit} />
        </GtFormGroup>
        <GtFormGroup label="SSL">
          <Checkbox checked={config.ssl ?? false} onCheckedChange={(c) => setConfig({ ...config, ssl: c })} disabled={!layout.adminEdit} />
        </GtFormGroup>
        <GtFormGroup label="Username">
          <Input value={config.username ?? ''} onChange={(e) => setConfig({ ...config, username: e.target.value })} disabled={!layout.adminEdit} />
        </GtFormGroup>
        <GtFormGroup label="Password">
          <Input type="password" value={password} onChange={(e) => handlePasswordChange(e.target.value)} onFocus={(e) => { if (password === '********') e.target.select() }} disabled={!layout.adminEdit} />
        </GtFormGroup>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">User DN structure</h3>
        <GtFormGroup label="User base DN">
          <Input value={config.userBaseDn ?? ''} onChange={(e) => setConfig({ ...config, userBaseDn: e.target.value })} disabled={!layout.adminEdit} />
        </GtFormGroup>
        <GtFormGroup label="User search filter">
          <Input value={config.userSearchFilter ?? ''} onChange={(e) => setConfig({ ...config, userSearchFilter: e.target.value })} disabled={!layout.adminEdit} />
        </GtFormGroup>
        <GtFormGroup label="Group base DN">
          <Input value={config.groupBaseDn ?? ''} onChange={(e) => setConfig({ ...config, groupBaseDn: e.target.value })} disabled={!layout.adminEdit} />
        </GtFormGroup>
        <GtFormGroup label="Group search filter">
          <Input value={config.groupSearchFilter ?? ''} onChange={(e) => setConfig({ ...config, groupSearchFilter: e.target.value })} disabled={!layout.adminEdit} />
        </GtFormGroup>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Role mappings</h3>
        {roleMappingBlocks.map((mapping, i) => (
          <div key={i} className="mb-4 rounded border p-4 bg-gray-50">
            <GtFormGroup label="LDAP group DN">
              <Input value={mapping.ldapGroupDn} onChange={(e) => updateRoleMapping(i, 'ldapGroupDn', e.target.value)} disabled={!layout.adminEdit} />
            </GtFormGroup>
            <GtFormGroup label="Glowroot roles">
              <Input
                value={mapping.glowrootRoles.join(', ')}
                onChange={(e) => updateRoleMapping(i, 'glowrootRoles', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Comma-separated role names"
                disabled={!layout.adminEdit}
              />
            </GtFormGroup>
            {layout.adminEdit && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeRoleMapping(i)}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            )}
          </div>
        ))}
        {layout.adminEdit && (
          <Button variant="outline" size="sm" onClick={addRoleMapping}>
            <Plus className="h-4 w-4" /> Add role mapping
          </Button>
        )}
      </div>

      {layout.adminEdit && (
        <GtButtonGroup onSave={handleSave} hasChanges={hasChanges} />
      )}

      {layout.adminEdit && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Test LDAP</h3>
          <GtFormGroup label="Username">
            <Input value={testUsername} onChange={(e) => setTestUsername(e.target.value)} />
          </GtFormGroup>
          <GtFormGroup label="Password">
            <Input type="password" value={testPassword} onChange={(e) => setTestPassword(e.target.value)} />
          </GtFormGroup>
          <div className="flex items-center gap-3 pl-[33.333%]">
            <Button variant="secondary" onClick={handleTest} loading={testing} disabled={!testUsername}>
              Test
            </Button>
          </div>
          {testResult && (
            <div className={`mt-3 pl-[33.333%] text-sm font-medium whitespace-pre-line ${testResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
