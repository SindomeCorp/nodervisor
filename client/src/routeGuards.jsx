import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSession } from './sessionContext.jsx';
import ui from './styles/ui.module.css';
import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_NONE,
  ROLE_VIEWER,
  resolveUserRole,
  userHasRole
} from '../../shared/roles.js';

function LoadingView({ message = 'Loading…' }) {
  return (
    <div className={ui.loadingContainer}>
      <div className={ui.loadingContent}>
        <div className={`${ui.spinner} ${ui.textCenter}`} role="status" aria-hidden="true"></div>
        <p className={ui.textMuted}>{message}</p>
      </div>
    </div>
  );
}

export function resolveRequireAuth({ status, user, pathname }) {
  if (status === 'loading') {
    return { type: 'loading' };
  }

  if (status !== 'authenticated') {
    return { type: 'redirect', to: '/auth/login' };
  }

  const role = resolveUserRole(user);
  if (role === ROLE_NONE && !pathname.startsWith('/request-access') && !pathname.startsWith('/auth')) {
    return { type: 'redirect', to: '/request-access' };
  }

  return { type: 'allow' };
}

function RequireAuth() {
  const location = useLocation();
  const { status, user } = useSession();
  const decision = resolveRequireAuth({ status, user, pathname: location.pathname });

  if (decision.type === 'loading') {
    return <LoadingView message="Checking session…" />;
  }

  if (decision.type === 'redirect') {
    return <Navigate to={decision.to} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function RequireRole({ allowedRoles, children }) {
  const { user } = useSession();
  const location = useLocation();
  const role = resolveUserRole(user);

  if (!userHasRole(user, allowedRoles)) {
    const redirectTo = role === ROLE_NONE ? '/request-access' : '/dashboard';
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return children;
}

function RequireGuest({ children }) {
  const { status } = useSession();

  if (status === 'loading') {
    return <LoadingView message="Checking session…" />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export { LoadingView, RequireAuth, RequireGuest, RequireRole };
