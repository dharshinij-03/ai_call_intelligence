import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { UserRole } from '../lib/types';
import { Spinner } from './Spinner';

export function ProtectedRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
