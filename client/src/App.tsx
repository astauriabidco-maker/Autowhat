import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DashboardHome from './pages/DashboardHome';
import Inbox from './pages/Inbox';
import Attendance from './pages/Attendance';
import Employees from './pages/Employees';
import EmployeeDetails from './pages/EmployeeDetails';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import IntegrationWhatsApp from './pages/IntegrationWhatsApp';
import IntegrationsManager from './pages/admin/IntegrationsManager';
import PrivacyShield from './pages/admin/PrivacyShield';
import OnboardingWizard from './pages/OnboardingWizard';
import ImportEmployees from './pages/ImportEmployees';
import AdminLayout from './layouts/AdminLayout';
import NetworkStatus from './components/NetworkStatus';
import { SiteProvider } from './context/SiteContext';
// SuperAdmin Pages
import SuperAdminLayout from './layouts/SuperAdminLayout';
import SuperAdminLogin from './pages/superadmin/Login';
import SuperAdminOverview from './pages/superadmin/Overview';
import SuperAdminTenants from './pages/superadmin/TenantsList';
import SuperAdminRevenue from './pages/superadmin/Revenue';
import SuperAdminLogs from './pages/superadmin/Logs';
import SuperAdminSessions from './pages/superadmin/Sessions';
import PlatformSettings from './pages/superadmin/PlatformSettings';
import Integrations from './pages/superadmin/Integrations';
import PlansManager from './pages/superadmin/PlansManager';
import Webhooks from './pages/superadmin/Webhooks';
import SupportInbox from './pages/superadmin/SupportInbox';
import TenantDetails from './pages/superadmin/TenantDetails';
import CreateTenant from './pages/superadmin/CreateTenant';
import CrmLeads from './pages/superadmin/CrmLeads';
import MarketingStudio from './pages/superadmin/MarketingStudio';
import ExpensesAdmin from './pages/superadmin/ExpensesAdmin';
import DocumentsAdmin from './pages/superadmin/DocumentsAdmin';
import ServerHealth from './pages/superadmin/ServerHealth';
import AiAgentsHub from './pages/superadmin/AiAgentsHub';
import PricingMatrix from './pages/superadmin/PricingMatrix';
import Billing from './pages/Billing';
import Support from './pages/Support';
// Legal Pages
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Notices from './pages/legal/Notices';
import CookieBanner from './components/CookieBanner';
import './i18n'; // Initialize i18n
import './index.css';

// Operations / FSM Pages
import Customers from './pages/operations/Customers';
import Dispatch from './pages/operations/Dispatch';
import OpsReports from './pages/operations/Reports';
import InterventionTypes from './pages/operations/InterventionTypes';
import OpsDashboard from './pages/operations/Dashboard';
// import Parts from './pages/operations/Parts';
import Recurring from './pages/operations/Recurring';
// import Quotes from './pages/operations/Quotes';
import MapKanban from './pages/operations/MapKanban';
import InterventionRequests from './pages/operations/InterventionRequests';
import SignaturePad from './pages/public/SignaturePad';


// Wrapper component for protected routes with AdminLayout
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        {/* Global Network Status Banner */}
        <NetworkStatus />

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Legal Pages */}
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/notices" element={<Notices />} />

          {/* Onboarding (Protected but no AdminLayout) */}
          <Route path="/onboarding" element={<OnboardingWizard />} />

          {/* Protected Routes with Admin Layout */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardHome /></ProtectedRoute>
          } />
          <Route path="/inbox" element={
            <ProtectedRoute><Inbox /></ProtectedRoute>
          } />
          <Route path="/attendance" element={
            <ProtectedRoute><Attendance /></ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute><Employees /></ProtectedRoute>
          } />
          <Route path="/employees/:id" element={
            <ProtectedRoute><EmployeeDetails /></ProtectedRoute>
          } />
          <Route path="/import-employees" element={
            <ProtectedRoute><ImportEmployees /></ProtectedRoute>
          } />
          <Route path="/expenses" element={
            <ProtectedRoute><Expenses /></ProtectedRoute>
          } />
          <Route path="/documents" element={
            <ProtectedRoute><Documents /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />
          <Route path="/privacy" element={
            <ProtectedRoute><PrivacyShield /></ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute><Billing /></ProtectedRoute>
          } />
          <Route path="/support" element={
            <ProtectedRoute><Support /></ProtectedRoute>
          } />
          <Route path="/settings/whatsapp" element={
            <ProtectedRoute><IntegrationWhatsApp /></ProtectedRoute>
          } />
          <Route path="/settings/integrations" element={
            <ProtectedRoute><IntegrationsManager /></ProtectedRoute>
          } />

          {/* Operations / FSM Routes */}
          <Route path="/operations/dashboard" element={
            <ProtectedRoute><OpsDashboard /></ProtectedRoute>
          } />
          <Route path="/operations/customers" element={
            <ProtectedRoute><Customers /></ProtectedRoute>
          } />
          <Route path="/operations/intervention-types" element={
            <ProtectedRoute><InterventionTypes /></ProtectedRoute>
          } />
          <Route path="/operations/dispatch" element={
            <ProtectedRoute><Dispatch /></ProtectedRoute>
          } />
          <Route path="/operations/reports" element={
            <ProtectedRoute><OpsReports /></ProtectedRoute>
          } />
{/* <Route path="/operations/parts" element={
            <ProtectedRoute><Parts /></ProtectedRoute>
          } /> */}
          <Route path="/operations/recurring" element={
            <ProtectedRoute><Recurring /></ProtectedRoute>
          } />
{/* <Route path="/operations/quotes" element={
            <ProtectedRoute><Quotes /></ProtectedRoute>
          } /> */}
          <Route path="/operations/map" element={
            <ProtectedRoute><MapKanban /></ProtectedRoute>
          } />
          <Route path="/operations/requests" element={
            <ProtectedRoute><InterventionRequests /></ProtectedRoute>
          } />

          {/* Public Signature (No Auth - Token protected) */}
          <Route path="/sign-intervention/:token" element={<SignaturePad />} />

          {/* SuperAdmin Routes */}
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/superadmin" element={<SuperAdminLayout />}>
            <Route index element={<SuperAdminOverview />} />
            <Route path="tenants" element={<SuperAdminTenants />} />
            <Route path="tenants/create" element={<CreateTenant />} />
            <Route path="tenants/:id" element={<TenantDetails />} />
            <Route path="revenue" element={<SuperAdminRevenue />} />
            <Route path="sessions" element={<SuperAdminSessions />} />
            <Route path="logs" element={<SuperAdminLogs />} />
            <Route path="settings" element={<PlatformSettings />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="plans" element={<PlansManager />} />
            <Route path="pricing-matrix" element={<PricingMatrix />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="support" element={<SupportInbox />} />
            <Route path="marketing" element={<MarketingStudio />} />
            <Route path="leads" element={<CrmLeads />} />
            <Route path="expenses" element={<ExpensesAdmin />} />
            <Route path="documents" element={<DocumentsAdmin />} />
            <Route path="health" element={<ServerHealth />} />
            <Route path="agents" element={<AiAgentsHub />} />
          </Route>
        </Routes>

        {/* Cookie Consent Banner */}
        <CookieBanner />
      </SiteProvider>
    </BrowserRouter>
  );
}

export default App;
