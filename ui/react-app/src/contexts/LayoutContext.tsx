/*
 * LayoutProvider — reads window.layout, polls /backend/check-layout every 60s,
 * handles version changes by re-fetching the full layout.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Layout } from '../types/layout'
import { apiGet, setLayoutVersion, setOnLayoutRefresh } from '../lib/api'

interface LayoutContextValue {
  layout: Layout
  refreshLayout: () => Promise<void>
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<Layout | null>(() => {
    const w = window as unknown as Record<string, unknown>
    return (w.layout as Layout) ?? null
  })

  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const refreshLayout = useCallback(async () => {
    try {
      const data = await apiGet<Layout>('/backend/layout')
      setLayout(data)
      setLayoutVersion(data.version)
      layoutRef.current = data
    } catch {
      // ignore — layout will be refreshed on next poll
    }
  }, [])

  // Wire the api module's onLayoutRefresh callback to us
  useEffect(() => {
    setOnLayoutRefresh(() => {
      refreshLayout()
    })
  }, [refreshLayout])

  // Set initial layout version
  useEffect(() => {
    if (layout) {
      setLayoutVersion(layout.version)
    }
  }, [layout])

  // Fetch layout if not available from window (dev mode)
  useEffect(() => {
    if (!layout) {
      refreshLayout()
    }
  }, [layout, refreshLayout])

  // Poll /backend/check-layout every 60s (triggers version check via api.ts interceptor)
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return
      try {
        // The response headers are checked by the api module's handleResponse,
        // which triggers onLayoutRefresh if the version changed.
        const contextPath =
          ((window as unknown as Record<string, unknown>).contextPath as string) || ''
        const base = contextPath && contextPath !== '/' ? contextPath : ''
        await fetch(base + '/backend/check-layout', { credentials: 'same-origin' })
      } catch {
        // ignore network errors
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  if (!layout) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <LayoutContext.Provider value={{ layout, refreshLayout }}>
      {children}
    </LayoutContext.Provider>
  )
}
