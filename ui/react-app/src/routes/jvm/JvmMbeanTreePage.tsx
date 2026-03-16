import { useCallback, useEffect, useRef, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { apiGet } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'

interface MBeanNode {
  objectName?: string
  nodeName: string
  childNodes?: MBeanNode[]
  expanded?: boolean
  attributeMap?: Record<string, unknown>
  loadingAttributes?: boolean
}

interface FlatEntry {
  node: MBeanNode
  depth: number
}

function flattenTree(nodes: MBeanNode[], depth: number): FlatEntry[] {
  const result: FlatEntry[] = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.expanded && node.childNodes) {
      result.push(...flattenTree(node.childNodes, depth + 1))
    }
  }
  return result
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value, null, 4)
  return String(value)
}

export function JvmMbeanTreePage() {
  const { agentId } = useAgent()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [, setTick] = useState(0)
  const treeRef = useRef<MBeanNode[]>([])

  // Force a re-render without replacing the tree array
  const rerender = useCallback(() => setTick(t => t + 1), [])

  const load = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    setError(null)
    try {
      const resp = await apiGet<Record<string, MBeanNode> & { agentNotConnected?: boolean }>('/backend/jvm/mbean-tree', {
        'agent-id': agentId,
      })
      if (resp.agentNotConnected) {
        treeRef.current = []
        setError({ agentNotConnected: true })
        return
      }
      const nodes: MBeanNode[] = Object.keys(resp)
        .filter(k => k !== 'agentNotConnected')
        .sort()
        .map(k => resp[k])
      treeRef.current = nodes
      rerender()
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  async function toggleNode(node: MBeanNode) {
    if (node.expanded) {
      // Collapse
      node.expanded = false
      delete node.attributeMap
      rerender()
      return
    }

    // Expand
    node.expanded = true

    // Leaf node with objectName and no children: load attributes
    if (node.objectName && (!node.childNodes || node.childNodes.length === 0)) {
      if (!node.attributeMap) {
        node.loadingAttributes = true
        rerender()
        try {
          const attrs = await apiGet<Record<string, unknown>>('/backend/jvm/mbean-attribute-map', {
            'agent-id': agentId!,
            'object-name': node.objectName,
          })
          node.attributeMap = attrs
        } catch {
          // silently ignore attribute load failures
        } finally {
          node.loadingAttributes = false
          rerender()
        }
        return
      }
    }

    rerender()
  }

  if (loading && treeRef.current.length === 0) return <PageSpinner />
  if (error && (error as { agentNotConnected?: boolean }).agentNotConnected) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        This feature is only available when the agent is running and connected
      </div>
    )
  }
  if (error && treeRef.current.length === 0) return <HttpError error={error} />

  const flatNodes = flattenTree(treeRef.current, 0)

  return (
    <div>
      <div className="mb-4">
        <Button variant="outline" size="sm" onClick={() => load()}>
          Refresh
        </Button>
      </div>
      <div className="rounded-lg border bg-white overflow-auto max-h-[80vh]">
        {flatNodes.map(({ node, depth }, i) => (
          <div key={node.objectName || `${depth}-${node.nodeName}-${i}`}>
            <div
              className="flex items-center px-4 py-1 text-sm hover:bg-gray-50 cursor-pointer border-b border-gray-50"
              style={{ paddingLeft: `${16 + depth * 24}px` }}
              onClick={() => toggleNode(node)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') toggleNode(node) }}
            >
              <span className="w-4 mr-1 text-gray-400 text-xs">
                {(node.childNodes && node.childNodes.length > 0) || node.objectName
                  ? node.expanded ? '\u25BC' : '\u25B6'
                  : ''}
              </span>
              <span className="font-mono text-xs">{node.nodeName}</span>
            </div>
            {/* Loading indicator for attributes */}
            {node.expanded && node.loadingAttributes && (
              <div
                className="py-1 text-xs text-gray-500"
                style={{ paddingLeft: `${40 + depth * 24}px` }}
              >
                Loading...
              </div>
            )}
            {/* Show attributes if expanded leaf */}
            {node.expanded && node.attributeMap && (
              <div
                className="bg-gray-50 border-b border-gray-100"
                style={{ paddingLeft: `${40 + depth * 24}px` }}
              >
                {Object.entries(node.attributeMap).map(([key, value]) => (
                  <div key={key} className="py-0.5 text-xs">
                    <span className="font-medium text-gray-700">{key}: </span>
                    <span className="text-gray-600 break-all">
                      {typeof value === 'object' && value !== null ? (
                        <pre className="inline whitespace-pre-wrap">{formatValue(value)}</pre>
                      ) : (
                        formatValue(value)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {flatNodes.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500">No MBeans found.</p>
        )}
      </div>
    </div>
  )
}
