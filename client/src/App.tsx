import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardHome from './pages/DashboardHome';
import Attendance from './pages/Attendance';
import Employees from './pages/Employees';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
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
import './i18n'; // Initialize i18n
import './index.css';


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

          {/* Protected Routes with Admin Layout */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardHome /></ProtectedRoute>
          } />
          <Route path="/attendance" element={
            <ProtectedRoute><Attendance /></ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute><Employees /></ProtectedRoute>
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

          {/* SuperAdmin Routes */}
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/superadmin" element={<SuperAdminLayout />}>
            <Route index element={<SuperAdminOverview />} />
            <Route path="tenants" element={<SuperAdminTenants />} />
            <Route path="revenue" element={<SuperAdminRevenue />} />
            <Route path="sessions" element={<SuperAdminSessions />} />
            <Route path="logs" element={<SuperAdminLogs />} />
            <Route path="settings" element={<PlatformSettings />} />
            <Route path="integrations" element={<Integrations />} />
          </Route>
        </Routes>
      </SiteProvider>
    </BrowserRouter>
  );
}

export default App;

