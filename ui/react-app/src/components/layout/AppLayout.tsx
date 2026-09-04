import { AuthProvider } from '../../contexts/AuthContext'
import { AgentProvider } from '../../contexts/AgentContext'
import { ThemeProvider } from '../../contexts/ThemeContext'
import { RangeSlotProvider } from '../../contexts/RangeSlotContext'
import { AppShell } from './AppShell'

export function AppLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AgentProvider>
          <RangeSlotProvider>
            <AppShell />
          </RangeSlotProvider>
        </AgentProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
