import { useLayout } from '../../contexts/LayoutContext'
import { useAgent } from '../../contexts/AgentContext'

export function Footer() {
  const { layout } = useLayout()
  const { agentRollup } = useAgent()

  return (
    <footer className="mt-auto border-t bg-white py-3 text-center text-xs text-gray-500">
      {layout.central ? (
        <>
          <div>Central collector version {layout.glowrootVersion}</div>
          {agentRollup && (
            <div>Agent version {agentRollup.glowrootVersion}</div>
          )}
        </>
      ) : (
        <div>Glowroot version {layout.glowrootVersion}</div>
      )}
    </footer>
  )
}
