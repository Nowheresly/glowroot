import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LayoutProvider } from '../contexts/LayoutContext'
import { AppLayout } from '../components/layout/AppLayout'
import { NotYetAvailable } from '../components/shared/NotYetAvailable'

export function AppRouter() {
  return (
    <BrowserRouter>
      <LayoutProvider>
        <Routes>
          <Route path="/modern" element={<AppLayout />}>
            {/* Default redirect */}
            <Route index element={<DefaultRedirect />} />

            {/* Transaction routes */}
            <Route path="transaction">
              <Route path="average" element={<NotYetAvailable />} />
              <Route path="percentiles" element={<NotYetAvailable />} />
              <Route path="throughput" element={<NotYetAvailable />} />
              <Route path="traces" element={<NotYetAvailable />} />
              <Route path="queries" element={<NotYetAvailable />} />
              <Route path="service-calls" element={<NotYetAvailable />} />
              <Route path="thread-profile" element={<NotYetAvailable />} />
              <Route path="thread-flame-graph" element={<NotYetAvailable />} />
              <Route path="trace-thread-flame-graph" element={<NotYetAvailable />} />
            </Route>

            {/* Error routes */}
            <Route path="error">
              <Route path="messages" element={<NotYetAvailable />} />
              <Route path="traces" element={<NotYetAvailable />} />
            </Route>

            {/* JVM routes */}
            <Route path="jvm">
              <Route path="gauges" element={<NotYetAvailable />} />
              <Route path="thread-dump" element={<NotYetAvailable />} />
              <Route path="jstack" element={<NotYetAvailable />} />
              <Route path="heap-dump" element={<NotYetAvailable />} />
              <Route path="heap-histogram" element={<NotYetAvailable />} />
              <Route path="force-gc" element={<NotYetAvailable />} />
              <Route path="mbean-tree" element={<NotYetAvailable />} />
              <Route path="system-properties" element={<NotYetAvailable />} />
              <Route path="environment" element={<NotYetAvailable />} />
              <Route path="capabilities" element={<NotYetAvailable />} />
            </Route>

            {/* Synthetic monitors (central only) */}
            <Route path="synthetic-monitors" element={<NotYetAvailable />} />

            {/* Incidents */}
            <Route path="incidents" element={<NotYetAvailable />} />

            {/* Reports */}
            <Route path="report">
              <Route path="ad-hoc" element={<NotYetAvailable />} />
            </Route>

            {/* Config routes */}
            <Route path="config">
              <Route path="general" element={<NotYetAvailable />} />
              <Route path="transaction" element={<NotYetAvailable />} />
              <Route path="gauge-list" element={<NotYetAvailable />} />
              <Route path="gauge" element={<NotYetAvailable />} />
              <Route path="jvm" element={<NotYetAvailable />} />
              <Route path="synthetic-monitor-list" element={<NotYetAvailable />} />
              <Route path="synthetic-monitor" element={<NotYetAvailable />} />
              <Route path="alert-list" element={<NotYetAvailable />} />
              <Route path="alert" element={<NotYetAvailable />} />
              <Route path="ui-defaults" element={<NotYetAvailable />} />
              <Route path="plugin-list" element={<NotYetAvailable />} />
              <Route path="plugin" element={<NotYetAvailable />} />
              <Route path="instrumentation-list" element={<NotYetAvailable />} />
              <Route path="instrumentation" element={<NotYetAvailable />} />
              <Route path="advanced" element={<NotYetAvailable />} />
              <Route path="json" element={<NotYetAvailable />} />
            </Route>

            {/* Admin routes */}
            <Route path="admin">
              <Route path="general" element={<NotYetAvailable />} />
              <Route path="user-list" element={<NotYetAvailable />} />
              <Route path="user" element={<NotYetAvailable />} />
              <Route path="role-list" element={<NotYetAvailable />} />
              <Route path="role" element={<NotYetAvailable />} />
              <Route path="web" element={<NotYetAvailable />} />
              <Route path="storage" element={<NotYetAvailable />} />
              <Route path="smtp" element={<NotYetAvailable />} />
              <Route path="http-proxy" element={<NotYetAvailable />} />
              <Route path="integration-list" element={<NotYetAvailable />} />
              <Route path="integration/ldap" element={<NotYetAvailable />} />
              <Route path="integration/pager-duty" element={<NotYetAvailable />} />
              <Route path="integration/slack" element={<NotYetAvailable />} />
              <Route path="integration/healthchecks-io" element={<NotYetAvailable />} />
              <Route path="json" element={<NotYetAvailable />} />
            </Route>

            {/* Profile routes */}
            <Route path="profile">
              <Route path="change-password" element={<NotYetAvailable />} />
            </Route>

            {/* Login */}
            <Route path="login" element={<NotYetAvailable />} />

            {/* Catch-all */}
            <Route path="*" element={<NotYetAvailable />} />
          </Route>

          {/* Redirect bare /modern to /modern/ */}
          <Route path="/" element={<Navigate to="/modern/" replace />} />
        </Routes>
      </LayoutProvider>
    </BrowserRouter>
  )
}

/**
 * Default redirect logic matching the AngularJS $urlRouterProvider.otherwise.
 * Redirects to the first section the user has access to.
 */
function DefaultRedirect() {
  // We need layout access, but this component is rendered inside LayoutProvider + AppLayout
  // which provides AuthProvider and AgentProvider, but we access layout via the window object
  // since this is a simple redirect.
  const w = window as unknown as Record<string, unknown>
  const layout = w.layout as {
    showNavbarTransaction?: boolean
    showNavbarError?: boolean
    showNavbarJvm?: boolean
    showNavbarConfig?: boolean
    adminView?: boolean
    central?: boolean
  } | undefined

  if (layout?.showNavbarTransaction) {
    return <Navigate to="/modern/transaction/average" replace />
  }
  if (layout?.showNavbarError) {
    return <Navigate to="/modern/error/messages" replace />
  }
  if (layout?.showNavbarJvm) {
    return <Navigate to="/modern/jvm/gauges" replace />
  }
  if (layout?.showNavbarConfig) {
    return <Navigate to="/modern/config/general" replace />
  }
  if (layout?.adminView) {
    if (layout.central) {
      return <Navigate to="/modern/admin/user-list" replace />
    }
    return <Navigate to="/modern/admin/general" replace />
  }
  return <Navigate to="/modern/transaction/average" replace />
}
