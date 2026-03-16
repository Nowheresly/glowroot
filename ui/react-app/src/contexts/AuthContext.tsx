/*
 * AuthProvider — login/signOut, 401 redirect handling.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLayout } from './LayoutContext'
import { apiPost, setOnLoginRedirect } from '../lib/api'

interface AuthContextValue {
  loggedIn: boolean
  loginEnabled: boolean
  ldap: boolean
  /** Message shown on the login page (e.g. "Your session has timed out") */
  loginMessage: string | null
  signOut: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  clearLoginMessage: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { layout, refreshLayout } = useLayout()
  const navigate = useNavigate()
  const location = useLocation()
  const [loginMessage, setLoginMessage] = useState<string | null>(null)
  const [returnPath, setReturnPath] = useState<string | null>(null)

  // Wire the api module's 401 redirect to us
  useEffect(() => {
    setOnLoginRedirect((timedOut: boolean) => {
      if (location.pathname === '/modern/login') return
      setReturnPath(location.pathname + location.search)
      setLoginMessage(timedOut ? 'Your session has timed out' : null)
      navigate('/modern/login')
    })
  }, [navigate, location])

  const login = useCallback(
    async (username: string, password: string) => {
      await apiPost('/backend/login', { username, password })
      await refreshLayout()
      if (returnPath && returnPath !== '/modern/login') {
        navigate(returnPath)
        setReturnPath(null)
      } else {
        navigate('/modern/')
      }
      setLoginMessage(null)
    },
    [refreshLayout, navigate, returnPath]
  )

  const signOut = useCallback(async () => {
    await apiPost('/backend/sign-out')
    await refreshLayout()
  }, [refreshLayout])

  const clearLoginMessage = useCallback(() => {
    setLoginMessage(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        loggedIn: layout.loggedIn,
        loginEnabled: layout.loginEnabled,
        ldap: layout.ldap,
        loginMessage,
        signOut,
        login,
        clearLoginMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
