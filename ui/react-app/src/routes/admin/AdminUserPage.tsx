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

interface UserConfig {
  username: string
  ldap: boolean
  roles: string[]
  version?: string
  newPassword?: string
}

interface UserData {
  config: UserConfig
  allRoles: string[]
  ldapAvailable?: boolean
}

export function AdminUserPage() {
  const { layout } = useLayout()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isNew = searchParams.has('new')
  const usernameParam = searchParams.get('username')

  const [data, setData] = useState<UserData | null>(null)
  const [config, setConfig] = useState<UserConfig>({ username: '', ldap: false, roles: [] })
  const [originalConfig, setOriginalConfig] = useState<UserConfig>({ username: '', ldap: false, roles: [] })
  const [password, setPassword] = useState('')
  const [verifyPassword, setVerifyPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isAnonymous = config.username.toLowerCase() === 'anonymous'

  const load = useCallback(async () => {
    try {
      if (isNew) {
        const resp = await apiGet<{ allRoles: string[]; ldapAvailable: boolean }>('/backend/admin/all-role-names')
        setData({ config: { username: '', ldap: false, roles: [] }, allRoles: resp.allRoles, ldapAvailable: resp.ldapAvailable })
        setConfig({ username: '', ldap: false, roles: [] })
        setOriginalConfig({ username: '', ldap: false, roles: [] })
      } else if (usernameParam) {
        const resp = await apiGet<UserData>('/backend/admin/users', { username: usernameParam })
        setData(resp)
        setConfig({ ...resp.config })
        setOriginalConfig({ ...resp.config })
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [isNew, usernameParam])

  useEffect(() => { load() }, [load])

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig) || password !== ''

  function toggleRole(role: string, checked: boolean) {
    const roles = checked
      ? [...config.roles, role].sort()
      : config.roles.filter((r) => r !== role)
    setConfig({ ...config, roles })
  }

  async function handleSave() {
    setSaveError(null)
    if (!isAnonymous && !config.ldap && password && password !== verifyPassword) {
      throw new Error('Passwords do not match')
    }
    if (config.roles.length === 0) {
      if (!window.confirm('Save user with no roles?')) return
    }
    const postData = {
      ...config,
      newPassword: password || undefined,
    }
    try {
      if (isNew) {
        const resp = await apiPost<UserData>('/backend/admin/users/add', postData)
        navigate(`/modern/admin/user?username=${encodeURIComponent(resp.config.username)}`, { replace: true })
        setData(resp)
        setConfig({ ...resp.config })
        setOriginalConfig({ ...resp.config })
        setPassword('')
        setVerifyPassword('')
      } else {
        const resp = await apiPost<UserData>('/backend/admin/users/update', postData)
        setData(resp)
        setConfig({ ...resp.config })
        setOriginalConfig({ ...resp.config })
        setPassword('')
        setVerifyPassword('')
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        throw new Error('Username already exists')
      }
      throw e
    }
  }

  async function handleDelete() {
    await apiPost('/backend/admin/users/remove', config)
    navigate('/modern/admin/user-list', { replace: true })
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />
  if (!data) return null

  const showPasswordFields = !isAnonymous && !config.ldap

  return (
    <div className="rounded-lg border bg-white p-6">
      <GtFormGroup label="Username">
        <Input
          value={config.username}
          onChange={(e) => setConfig({ ...config, username: e.target.value })}
          disabled={!isNew || !layout.adminEdit}
        />
      </GtFormGroup>

      {!isAnonymous && data.ldapAvailable && (
        <GtFormGroup label="Use LDAP">
          <Checkbox
            checked={config.ldap}
            onCheckedChange={(c) => setConfig({ ...config, ldap: !!c })}
            disabled={!layout.adminEdit}
          />
        </GtFormGroup>
      )}

      {showPasswordFields && (
        <>
          <GtFormGroup label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!layout.adminEdit}
            />
          </GtFormGroup>
          <GtFormGroup label="Verify password">
            <Input
              type="password"
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              disabled={!layout.adminEdit}
            />
            {password && verifyPassword && password !== verifyPassword && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </GtFormGroup>
        </>
      )}

      <GtFormGroup label="Roles">
        <div className="space-y-2">
          {data.allRoles.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={config.roles.includes(role)}
                onCheckedChange={(c) => toggleRole(role, c)}
                disabled={!layout.adminEdit}
              />
              {role}
            </label>
          ))}
          {/* Show roles that no longer exist */}
          {config.roles
            .filter((r) => !data.allRoles.includes(r))
            .map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={true}
                  onCheckedChange={(c) => toggleRole(role, c)}
                  disabled={!layout.adminEdit}
                />
                <span className="text-red-600">{role} (role not found)</span>
              </label>
            ))}
        </div>
      </GtFormGroup>

      {saveError && (
        <p className="text-sm text-red-600 mb-3">{saveError}</p>
      )}

      {layout.adminEdit && (
        <GtButtonGroup
          onSave={handleSave}
          hasChanges={hasChanges}
          saveLabel={isNew ? 'Add' : 'Save changes'}
          onDelete={!isNew && config.version !== undefined ? handleDelete : undefined}
          showDelete={!isNew && config.version !== undefined}
          deleteConfirmMessage={`Are you sure you want to delete user '${config.username}'?`}
        />
      )}
    </div>
  )
}
