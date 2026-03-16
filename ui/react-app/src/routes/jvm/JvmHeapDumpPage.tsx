import { useCallback, useEffect, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet, apiPost } from '../../lib/api'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface HeapDumpDefaultDirData {
  agentNotConnected?: boolean
  directory: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

export function JvmHeapDumpPage() {
  const { agentId } = useAgent()
  const [directory, setDirectory] = useState('')
  const [agentNotConnected, setAgentNotConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const [checkingDisk, setCheckingDisk] = useState(false)
  const [availableDiskSpace, setAvailableDiskSpace] = useState<number | null>(null)
  const [diskError, setDiskError] = useState('')

  const [dumping, setDumping] = useState(false)
  const [dumpResult, setDumpResult] = useState<string | null>(null)
  const [dumpError, setDumpError] = useState('')

  const load = useCallback(async () => {
    if (!agentId) return
    try {
      const resp = await apiGet<HeapDumpDefaultDirData>('/backend/jvm/heap-dump-default-dir', {
        'agent-id': agentId,
      })
      setAgentNotConnected(!!resp.agentNotConnected)
      setDirectory(resp.directory || '')
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  async function handleCheckDiskSpace() {
    if (!agentId) return
    setCheckingDisk(true)
    setDiskError('')
    setAvailableDiskSpace(null)
    try {
      const resp = await apiPost<number | { directoryDoesNotExist?: boolean }>(
        '/backend/jvm/available-disk-space?agent-id=' + encodeURIComponent(agentId),
        { directory }
      )
      if (typeof resp === 'object' && resp.directoryDoesNotExist) {
        setDiskError('Directory does not exist')
      } else if (typeof resp === 'number') {
        setAvailableDiskSpace(resp)
      }
    } catch (e) {
      setDiskError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setCheckingDisk(false)
    }
  }

  async function handleHeapDump() {
    if (!agentId) return
    setDumping(true)
    setDumpError('')
    setDumpResult(null)
    setAvailableDiskSpace(null)
    try {
      const resp = await apiPost<{
        error?: string
        directoryDoesNotExist?: boolean
        filePath?: string
      }>(
        '/backend/jvm/heap-dump?agent-id=' + encodeURIComponent(agentId),
        { directory }
      )
      if (resp.directoryDoesNotExist) {
        setDumpError('Directory does not exist')
      } else if (resp.error) {
        setDumpError(resp.error)
      } else if (resp.filePath) {
        setDumpResult('Heap dump written to: ' + resp.filePath)
      } else {
        setDumpResult('Heap dump completed')
      }
    } catch (e) {
      setDumpError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setDumping(false)
    }
  }

  if (loading) return <PageSpinner />
  if (error) return <HttpError error={error} />

  if (agentNotConnected) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        This feature is only available when the agent is running and connected
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      <div>
        <label htmlFor="directory" className="block text-sm font-medium text-gray-700 mb-1">
          Directory
        </label>
        <Input
          id="directory"
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
          className="max-w-lg"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleCheckDiskSpace} loading={checkingDisk}>
          Check disk space
        </Button>
        <Button onClick={handleHeapDump} loading={dumping}>
          Heap dump
        </Button>
      </div>
      {availableDiskSpace !== null && (
        <p className="text-sm text-gray-700">
          Available disk space: {formatBytes(availableDiskSpace)}
        </p>
      )}
      {diskError && <p className="text-sm text-red-600">{diskError}</p>}
      {dumpResult && <p className="text-sm text-green-600">{dumpResult}</p>}
      {dumpError && <p className="text-sm text-red-600">{dumpError}</p>}
    </div>
  )
}
