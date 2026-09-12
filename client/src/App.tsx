import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NetworkStatus from './components/NetworkStatus';
import { SiteProvider } from './context/SiteContext';
// SuperAdmin Pages
// Legal Pages
import CookieBanner from './components/CookieBanner';
import './i18n'; // Initialize i18n
import './index.css';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const MagicLogin = lazy(() => import('./pages/MagicLogin'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'));

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeDetails = lazy(() => import('./pages/EmployeeDetails'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Documents = lazy(() => import('./pages/Documents'));
const Settings = lazy(() => import('./pages/Settings'));
const SiteGpsCenter = lazy(() => import('./pages/SiteGpsCenter'));
const IntegrationWhatsApp = lazy(() => import('./pages/IntegrationWhatsApp'));
const IntegrationsManager = lazy(() => import('./pages/admin/IntegrationsManager'));
const PrivacyShield = lazy(() => import('./pages/admin/PrivacyShield'));
const ImportEmployees = lazy(() => import('./pages/ImportEmployees'));
const Billing = lazy(() => import('./pages/Billing'));
const Support = lazy(() => import('./pages/Support'));

const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const Notices = lazy(() => import('./pages/legal/Notices'));

const SuperAdminLayout = lazy(() => import('./layouts/SuperAdminLayout'));
const SuperAdminLogin = lazy(() => import('./pages/superadmin/Login'));
const SuperAdminOverview = lazy(() => import('./pages/superadmin/Overview'));
const SuperAdminTenants = lazy(() => import('./pages/superadmin/TenantsList'));
const SuperAdminRevenue = lazy(() => import('./pages/superadmin/Revenue'));
const SuperAdminLogs = lazy(() => import('./pages/superadmin/Logs'));
const SuperAdminSessions = lazy(() => import('./pages/superadmin/Sessions'));
const PlatformSettings = lazy(() => import('./pages/superadmin/PlatformSettings'));
const Integrations = lazy(() => import('./pages/superadmin/Integrations'));
const PlansManager = lazy(() => import('./pages/superadmin/PlansManager'));
const Webhooks = lazy(() => import('./pages/superadmin/Webhooks'));
const SupportInbox = lazy(() => import('./pages/superadmin/SupportInbox'));
const TenantDetails = lazy(() => import('./pages/superadmin/TenantDetails'));
const CreateTenant = lazy(() => import('./pages/superadmin/CreateTenant'));
const MarketingStudio = lazy(() => import('./pages/superadmin/MarketingStudio'));
const ExpensesAdmin = lazy(() => import('./pages/superadmin/ExpensesAdmin'));
const DocumentsAdmin = lazy(() => import('./pages/superadmin/DocumentsAdmin'));
const ServerHealth = lazy(() => import('./pages/superadmin/ServerHealth'));
const AiAgentsHub = lazy(() => import('./pages/superadmin/AiAgentsHub'));
const PricingMatrix = lazy(() => import('./pages/superadmin/PricingMatrix'));
const AutomationCockpit = lazy(() => import('./pages/superadmin/AutomationCockpit'));
const WhatsAppNumbers = lazy(() => import('./pages/superadmin/WhatsAppNumbers'));


// Wrapper component for protected routes with AdminLayout
function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-medium text-slate-500">
      Chargement...
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        {/* Global Network Status Banner */}
        <NetworkStatus />

        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/magic-login" element={<MagicLogin />} />
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
          <Route path="/sites-gps" element={
            <ProtectedRoute><SiteGpsCenter /></ProtectedRoute>
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

          {/* Legacy operations routes are intentionally retired from the product surface. */}
          <Route path="/operations/*" element={<Navigate to="/dashboard" replace />} />

          <Route path="/sign-intervention/:token" element={<Navigate to="/" replace />} />

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
            <Route path="whatsapp-numbers" element={<WhatsAppNumbers />} />
            <Route path="plans" element={<PlansManager />} />
            <Route path="pricing-matrix" element={<PricingMatrix />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="support" element={<SupportInbox />} />
            <Route path="marketing" element={<MarketingStudio />} />
            <Route path="leads" element={<Navigate to="/superadmin/tenants" replace />} />
            <Route path="expenses" element={<ExpensesAdmin />} />
            <Route path="documents" element={<DocumentsAdmin />} />
            <Route path="health" element={<ServerHealth />} />
            <Route path="agents" element={<AiAgentsHub />} />
            <Route path="automations" element={<AutomationCockpit />} />
          </Route>
          </Routes>
        </Suspense>

        {/* Cookie Consent Banner */}
        <CookieBanner />
      </SiteProvider>
    </BrowserRouter>
  );
}

export default App;
