import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LayoutProvider } from '../contexts/LayoutContext'
import { AppLayout } from '../components/layout/AppLayout'
import { NotYetAvailable } from '../components/shared/NotYetAvailable'
// JVM pages
import { JvmLayout } from './jvm/JvmLayout'
import { JvmEnvironmentPage } from './jvm/JvmEnvironmentPage'
import { JvmSystemPropertiesPage } from './jvm/JvmSystemPropertiesPage'
import { JvmCapabilitiesPage } from './jvm/JvmCapabilitiesPage'
import { JvmForceGcPage } from './jvm/JvmForceGcPage'
import { JvmThreadDumpPage } from './jvm/JvmThreadDumpPage'
import { JvmJstackPage } from './jvm/JvmJstackPage'
import { JvmHeapDumpPage } from './jvm/JvmHeapDumpPage'
import { JvmHeapHistogramPage } from './jvm/JvmHeapHistogramPage'
import { JvmMbeanTreePage } from './jvm/JvmMbeanTreePage'
import { JvmGaugesPage } from './jvm/JvmGaugesPage'
// Login & Profile
import { LoginPage } from './LoginPage'
import { ChangePasswordPage } from './profile/ChangePasswordPage'
// Config pages
import { ConfigLayout } from './config/ConfigLayout'
import { ConfigGeneralPage } from './config/ConfigGeneralPage'
import { ConfigTransactionPage } from './config/ConfigTransactionPage'
import { ConfigGaugeListPage } from './config/ConfigGaugeListPage'
import { ConfigGaugePage } from './config/ConfigGaugePage'
import { ConfigJvmPage } from './config/ConfigJvmPage'
import { ConfigSyntheticMonitorListPage } from './config/ConfigSyntheticMonitorListPage'
import { ConfigSyntheticMonitorPage } from './config/ConfigSyntheticMonitorPage'
import { ConfigAlertListPage } from './config/ConfigAlertListPage'
import { ConfigAlertPage } from './config/ConfigAlertPage'
import { ConfigUiDefaultsPage } from './config/ConfigUiDefaultsPage'
import { ConfigPluginListPage } from './config/ConfigPluginListPage'
import { ConfigPluginPage } from './config/ConfigPluginPage'
import { ConfigInstrumentationListPage } from './config/ConfigInstrumentationListPage'
import { ConfigInstrumentationPage } from './config/ConfigInstrumentationPage'
import { ConfigAdvancedPage } from './config/ConfigAdvancedPage'
import { ConfigJsonPage } from './config/ConfigJsonPage'
// Admin pages
import { AdminLayout } from './admin/AdminLayout'
import { AdminGeneralPage } from './admin/AdminGeneralPage'
import { AdminWebPage } from './admin/AdminWebPage'
import { AdminStoragePage } from './admin/AdminStoragePage'
import { AdminSmtpPage } from './admin/AdminSmtpPage'
import { AdminHttpProxyPage } from './admin/AdminHttpProxyPage'
import { AdminIntegrationListPage } from './admin/AdminIntegrationListPage'
import { AdminLdapPage } from './admin/AdminLdapPage'
import { AdminPagerDutyPage } from './admin/AdminPagerDutyPage'
import { AdminSlackPage } from './admin/AdminSlackPage'
import { AdminHealthchecksIoPage } from './admin/AdminHealthchecksIoPage'
import { AdminUserListPage } from './admin/AdminUserListPage'
import { AdminUserPage } from './admin/AdminUserPage'
import { AdminRoleListPage } from './admin/AdminRoleListPage'
import { AdminRolePage } from './admin/AdminRolePage'
import { AdminJsonPage } from './admin/AdminJsonPage'

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
            <Route path="jvm" element={<JvmLayout />}>
              <Route path="gauges" element={<JvmGaugesPage />} />
              <Route path="thread-dump" element={<JvmThreadDumpPage />} />
              <Route path="jstack" element={<JvmJstackPage />} />
              <Route path="heap-dump" element={<JvmHeapDumpPage />} />
              <Route path="heap-histogram" element={<JvmHeapHistogramPage />} />
              <Route path="force-gc" element={<JvmForceGcPage />} />
              <Route path="mbean-tree" element={<JvmMbeanTreePage />} />
              <Route path="system-properties" element={<JvmSystemPropertiesPage />} />
              <Route path="environment" element={<JvmEnvironmentPage />} />
              <Route path="capabilities" element={<JvmCapabilitiesPage />} />
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
            <Route path="config" element={<ConfigLayout />}>
              <Route path="general" element={<ConfigGeneralPage />} />
              <Route path="transaction" element={<ConfigTransactionPage />} />
              <Route path="gauge-list" element={<ConfigGaugeListPage />} />
              <Route path="gauge" element={<ConfigGaugePage />} />
              <Route path="jvm" element={<ConfigJvmPage />} />
              <Route path="synthetic-monitor-list" element={<ConfigSyntheticMonitorListPage />} />
              <Route path="synthetic-monitor" element={<ConfigSyntheticMonitorPage />} />
              <Route path="alert-list" element={<ConfigAlertListPage />} />
              <Route path="alert" element={<ConfigAlertPage />} />
              <Route path="ui-defaults" element={<ConfigUiDefaultsPage />} />
              <Route path="plugin-list" element={<ConfigPluginListPage />} />
              <Route path="plugin" element={<ConfigPluginPage />} />
              <Route path="instrumentation-list" element={<ConfigInstrumentationListPage />} />
              <Route path="instrumentation" element={<ConfigInstrumentationPage />} />
              <Route path="advanced" element={<ConfigAdvancedPage />} />
              <Route path="json" element={<ConfigJsonPage />} />
            </Route>

            {/* Admin routes */}
            <Route path="admin" element={<AdminLayout />}>
              <Route path="general" element={<AdminGeneralPage />} />
              <Route path="user-list" element={<AdminUserListPage />} />
              <Route path="user" element={<AdminUserPage />} />
              <Route path="role-list" element={<AdminRoleListPage />} />
              <Route path="role" element={<AdminRolePage />} />
              <Route path="web" element={<AdminWebPage />} />
              <Route path="storage" element={<AdminStoragePage />} />
              <Route path="smtp" element={<AdminSmtpPage />} />
              <Route path="http-proxy" element={<AdminHttpProxyPage />} />
              <Route path="integration-list" element={<AdminIntegrationListPage />} />
              <Route path="integration/ldap" element={<AdminLdapPage />} />
              <Route path="integration/pager-duty" element={<AdminPagerDutyPage />} />
              <Route path="integration/slack" element={<AdminSlackPage />} />
              <Route path="integration/healthchecks-io" element={<AdminHealthchecksIoPage />} />
              <Route path="json" element={<AdminJsonPage />} />
            </Route>

            {/* Profile routes */}
            <Route path="profile">
              <Route path="change-password" element={<ChangePasswordPage />} />
            </Route>

            {/* Login */}
            <Route path="login" element={<LoginPage />} />

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
