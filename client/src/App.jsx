import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes
} from 'react-router-dom';
import { useState } from 'react';

import Dashboard from './Dashboard.jsx';
import HostsListPage from './pages/HostsListPage.jsx';
import HostFormPage from './pages/HostFormPage.jsx';
import GroupsListPage from './pages/GroupsListPage.jsx';
import GroupFormPage from './pages/GroupFormPage.jsx';
import UsersListPage from './pages/UsersListPage.jsx';
import UserFormPage from './pages/UserFormPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import RequestAccessPage from './pages/RequestAccessPage.jsx';
import { SessionContext, SessionProvider, useSession } from './sessionContext.jsx';
import { RequireAuth, RequireGuest, RequireRole } from './routeGuards.jsx';
import layoutStyles from './AppLayout.module.css';
import ui from './styles/ui.module.css';
import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_NONE,
  ROLE_VIEWER,
  resolveUserRole,
  userHasRole
} from '../../shared/roles.js';

function Layout() {
  const { user, logout } = useSession();
  const canViewDashboard = userHasRole(user, [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER]);
  const canManageInfrastructure = userHasRole(user, [ROLE_ADMIN, ROLE_MANAGER]);
  const canManageUsers = userHasRole(user, [ROLE_ADMIN]);
  const [logoutError, setLogoutError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout(event) {
    event.preventDefault();
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (err) {
      setLogoutError(err.message ?? 'Failed to sign out.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className={layoutStyles.dashboardAppContainer}>
      <div className={layoutStyles.headerContainer}>
        <header className={layoutStyles.headerWrapper}>
          <h1 className={layoutStyles.headerTitle}>
            <Link to="/" className={layoutStyles.brandLink}>
              Nodervisor
            </Link>
          </h1>
          <nav aria-label="Primary navigation">
            <ul className={layoutStyles.navList}>
              {canViewDashboard && (
                <li>
                  <Link to="/dashboard" className={layoutStyles.navLink}>
                    Dashboard
                  </Link>
                </li>
              )}
              {canManageInfrastructure && (
                <>
                  <li>
                    <Link to="/hosts" className={layoutStyles.navLink}>
                      Hosts
                    </Link>
                  </li>
                  <li>
                    <Link to="/groups" className={layoutStyles.navLink}>
                      Groups
                    </Link>
                  </li>
                </>
              )}
              {canManageUsers && (
                <li>
                  <Link to="/users" className={layoutStyles.navLink}>
                    Users
                  </Link>
                </li>
              )}
              <li>
                <button
                  type="button"
                  className={layoutStyles.navButton}
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </li>
            </ul>
          </nav>
        </header>
      </div>
      <main className={layoutStyles.appMain}>
        <div className={layoutStyles.appMainContent}>
          {logoutError && (
            <div className={`${ui.alert} ${ui.alertError} ${layoutStyles.alertSpacing}`} role="alert">
              {logoutError}
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AppRoutes() {
  const { allowSelfRegistration } = useSession();

  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER]}>
                <Dashboard />
              </RequireRole>
            }
          />
          <Route
            path="hosts"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN, ROLE_MANAGER]}>
                <HostsListPage />
              </RequireRole>
            }
          />
          <Route
            path="hosts/new"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN, ROLE_MANAGER]}>
                <HostFormPage mode="create" />
              </RequireRole>
            }
          />
          <Route
            path="hosts/:hostId"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN, ROLE_MANAGER]}>
                <HostFormPage mode="edit" />
              </RequireRole>
            }
          />
          <Route
            path="groups"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN, ROLE_MANAGER]}>
                <GroupsListPage />
              </RequireRole>
            }
          />
          <Route
            path="groups/new"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN, ROLE_MANAGER]}>
                <GroupFormPage mode="create" />
              </RequireRole>
            }
          />
          <Route
            path="groups/:groupId"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN, ROLE_MANAGER]}>
                <GroupFormPage mode="edit" />
              </RequireRole>
            }
          />
          <Route
            path="users"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN]}>
                <UsersListPage />
              </RequireRole>
            }
          />
          <Route
            path="users/new"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN]}>
                <UserFormPage mode="create" />
              </RequireRole>
            }
          />
          <Route
            path="users/:userId"
            element={
              <RequireRole allowedRoles={[ROLE_ADMIN]}>
                <UserFormPage mode="edit" />
              </RequireRole>
            }
          />
          <Route path="request-access" element={<RequestAccessPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
      <Route path="auth">
        <Route index element={<Navigate to="login" replace />} />
        <Route
          path="login"
          element={
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          }
        />
        {allowSelfRegistration ? (
          <Route
            path="register"
            element={
              <RequireGuest>
                <RegisterPage />
              </RequireGuest>
            }
          />
        ) : (
          <Route path="register" element={<Navigate to="/auth/login" replace />} />
        )}
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App({ initialState }) {
  return (
    <SessionProvider initialState={initialState}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}

export { SessionProvider, AppRoutes, SessionContext, useSession };
