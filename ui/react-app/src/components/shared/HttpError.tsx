import { ApiError } from '../../lib/api'

interface HttpErrorProps {
  error: unknown
}

/**
 * Display an HTTP error with optional stack trace.
 * Mirrors the error display pattern from the AngularJS httpErrors service.
 */
export function HttpError({ error }: HttpErrorProps) {
  if (!error) return null

  let headline = 'An error occurred'
  let message = ''
  let stackTrace = ''

  if (error instanceof ApiError) {
    if (error.status === 0 || error.status === -1) {
      headline = 'Unable to connect to server'
    } else if (error.status === 403) {
      headline = 'Access denied'
      message = "You don't have permission for this action"
    } else if (error.status === 412) {
      headline = 'Update conflict'
      message =
        'Someone else has updated the data on this page, please reload and try again'
    } else {
      message = error.message
      stackTrace = error.stackTrace || ''
    }
  } else if (error instanceof Error) {
    message = error.message
  } else {
    message = String(error)
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <h3 className="text-sm font-semibold text-red-800">{headline}</h3>
      {message && <p className="mt-1 text-sm text-red-700">{message}</p>}
      {stackTrace && (
        <pre className="mt-2 max-h-48 overflow-auto text-xs text-red-600 bg-red-100 rounded p-2">
          {stackTrace}
        </pre>
      )}
    </div>
  )
}
