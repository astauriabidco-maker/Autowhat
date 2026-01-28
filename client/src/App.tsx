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
import AdminLayout from './layouts/AdminLayout';
import { SiteProvider } from './context/SiteContext';
import './index.css';


// Wrapper component for protected routes with AdminLayout
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
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
          <Route path="/expenses" element={
            <ProtectedRoute><Expenses /></ProtectedRoute>
          } />
          <Route path="/documents" element={
            <ProtectedRoute><Documents /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />
        </Routes>
      </SiteProvider>
    </BrowserRouter>
  );
}

export default App;

