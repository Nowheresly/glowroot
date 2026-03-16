/*
 * API client for Glowroot backend.
 *
 * Replicates the layout version checking logic from the AngularJS HTTP interceptor
 * (app.js lines 34-145). On every backend response the Glowroot-Layout-Version header
 * is compared against the current layout version; if different the layout is refreshed.
 */

type LayoutRefreshFn = () => void
type LoginRedirectFn = (timedOut: boolean) => void

let layoutVersion: string | null = null
let onLayoutRefresh: LayoutRefreshFn | null = null
let onLoginRedirect: LoginRedirectFn | null = null

export function setLayoutVersion(version: string) {
  layoutVersion = version
}

export function setOnLayoutRefresh(fn: LayoutRefreshFn) {
  onLayoutRefresh = fn
}

export function setOnLoginRedirect(fn: LoginRedirectFn) {
  onLoginRedirect = fn
}

function getContextPath(): string {
  return (
    (window as unknown as Record<string, unknown>).contextPath as string
  ) || ''
}

function buildUrl(path: string): string {
  const contextPath = getContextPath()
  if (contextPath && contextPath !== '/') {
    return contextPath + path
  }
  return path
}

function checkLayoutVersion(headers: Headers) {
  const newVersion = headers.get('Glowroot-Layout-Version')
  if (newVersion && layoutVersion && newVersion !== layoutVersion) {
    onLayoutRefresh?.()
  }
}

async function handleResponse(response: Response): Promise<Response> {
  checkLayoutVersion(response.headers)

  if (response.status === 401) {
    const data = await response.json().catch(() => ({}))
    onLoginRedirect?.(!!data.timedOut)
    // return a never-resolving promise (same pattern as the AngularJS interceptor)
    return new Promise(() => {})
  }

  return response
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | string[] | number | undefined>
): Promise<T> {
  let url = buildUrl(path)
  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue
      if (Array.isArray(value)) {
        for (const v of value) {
          searchParams.append(key, v)
        }
      } else {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    if (qs) {
      url += '?' + qs
    }
  }
  const response = await handleResponse(
    await fetch(url, { credentials: 'same-origin' })
  )
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new ApiError(response.status, errorData?.message, errorData?.stackTrace)
  }
  const text = await response.text()
  if (!text) return undefined as unknown as T
  return JSON.parse(text)
}

export async function apiPost<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const url = buildUrl(path)
  const response = await handleResponse(
    await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  )
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new ApiError(response.status, errorData?.message, errorData?.stackTrace)
  }
  const text = await response.text()
  if (!text) return undefined as unknown as T
  return JSON.parse(text)
}

export class ApiError extends Error {
  status: number
  stackTrace?: string

  constructor(status: number, message?: string, stackTrace?: string) {
    super(message || `HTTP ${status}`)
    this.status = status
    this.stackTrace = stackTrace
  }
}
