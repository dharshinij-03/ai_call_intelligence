import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

import { CitizenCallPage } from './pages/citizen/CitizenCallPage';
import { CitizenComplaintsPage } from './pages/citizen/CitizenComplaintsPage';

import { OperatorQueuePage } from './pages/operator/OperatorQueuePage';
import { OperatorComplaintsPage } from './pages/operator/OperatorComplaintsPage';

import { OfficerComplaintsPage } from './pages/officer/OfficerComplaintsPage';
import { OfficerComplaintDetailPage } from './pages/officer/OfficerComplaintDetailPage';

import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage';
import { AdminDepartmentDetailPage } from './pages/admin/AdminDepartmentDetailPage';
import { AdminComplaintsPage } from './pages/admin/AdminComplaintsPage';
import { AdminComplaintDetailPage } from './pages/admin/AdminComplaintDetailPage';
import { AdminHeatmapPage } from './pages/admin/AdminHeatmapPage';
import { AdminTrendsPage } from './pages/admin/AdminTrendsPage';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const home: Record<string, string> = {
    citizen: '/citizen/call',
    operator: '/operator/queue',
    officer: '/officer/complaints',
    admin: '/admin',
  };
  return <Navigate to={home[user.role] ?? '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<Layout />}>
        <Route index element={<HomeRedirect />} />

        <Route
          path="/citizen/call"
          element={
            <ProtectedRoute roles={['citizen']}>
              <CitizenCallPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/complaints"
          element={
            <ProtectedRoute roles={['citizen']}>
              <CitizenComplaintsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/operator/queue"
          element={
            <ProtectedRoute roles={['operator']}>
              <OperatorQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/complaints"
          element={
            <ProtectedRoute roles={['operator']}>
              <OperatorComplaintsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/officer/complaints"
          element={
            <ProtectedRoute roles={['officer']}>
              <OfficerComplaintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/officer/complaints/:callId"
          element={
            <ProtectedRoute roles={['officer']}>
              <OfficerComplaintDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDepartmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/departments/:departmentId"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDepartmentDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/complaints"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminComplaintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/complaints/:callId"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminComplaintDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/heatmap"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminHeatmapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/trends"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminTrendsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
