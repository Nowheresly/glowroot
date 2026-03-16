import { useState } from 'react'
import { useLayout } from '../contexts/LayoutContext'
import { apiPost } from '../lib/api'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import type { Layout } from '../types/layout'

export function LoginPage() {
  const { refreshLayout } = useLayout()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const resp = await apiPost<Layout & { incorrectLogin?: boolean }>('/backend/login', {
        username,
        password,
      })
      if (resp.incorrectLogin) {
        setError('Incorrect username or password')
        setPassword('')
        setLoading(false)
        return
      }
      await refreshLayout()
      window.location.href = '/modern/'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-20">
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
