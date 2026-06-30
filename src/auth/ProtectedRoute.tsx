import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export interface ProtectedRouteProps {
  /** Where to send unauthenticated visitors. */
  redirectTo?: string;
  /** Explicit children to guard; when omitted an <Outlet/> is rendered (nested routes). */
  children?: ReactNode;
}

/**
 * Route guard: renders its children (or the nested route <Outlet/>) only when a
 * user is signed in, otherwise redirects to the login route — remembering where
 * the user was headed via location state so the login page can send them back.
 */
export function ProtectedRoute({ redirectTo = '/login', children }: ProtectedRouteProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
