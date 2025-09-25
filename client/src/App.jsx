import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from 'react-router-dom';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import Dashboard from './Dashboard.jsx';
import HostsListPage from './pages/HostsListPage.jsx';
import HostFormPage from './pages/HostFormPage.jsx';
import GroupsListPage from './pages/GroupsListPage.jsx';
import GroupFormPage from './pages/GroupFormPage.jsx';
import UsersListPage from './pages/UsersListPage.jsx';
import UserFormPage from './pages/UserFormPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import { createAuthClient } from './apiClient.js';
import layoutStyles from './AppLayout.module.css';
import ui from './styles/ui.module.css';

export const SessionContext = createContext({
  user: null,
  status: 'loading',
  allowSelfRegistration: true,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
  refreshSession: async () => {}
});

export function useSession() {
  return useContext(SessionContext);
}

function SessionProvider({ initialState, children }) {
  const authClient = useMemo(() => createAuthClient(initialState?.auth), [initialState]);
  const initialAllowSelfRegistration =
    typeof initialState?.auth?.allowSelfRegistration === 'boolean'
      ? initialState.auth.allowSelfRegistration
      : Boolean(initialState?.auth?.register);
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(initialAllowSelfRegistration);
  const [user, setUser] = useState(initialState?.user ?? null);
  const [status, setStatus] = useState(initialState?.user ? 'authenticated' : 'loading');
  const initialFetchCompleted = useRef(Boolean(initialState?.user));

  const refreshSession = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await authClient.getSession();
      const sessionUser = data?.user ?? null;
      const allowRegistration = data?.auth?.allowSelfRegistration;
      setAllowSelfRegistration((prev) =>
        typeof allowRegistration === 'boolean' ? allowRegistration : prev
      );
      setUser(sessionUser);
      setStatus(sessionUser ? 'authenticated' : 'unauthenticated');
      return sessionUser;
    } catch (err) {
      setUser(null);
      setStatus('unauthenticated');
      throw err;
    }
  }, [authClient]);

  useEffect(() => {
    if (initialFetchCompleted.current) {
      return;
    }
    initialFetchCompleted.current = true;
    refreshSession().catch(() => {
      /* handled by refreshSession */
    });
  }, [refreshSession]);

  const login = useCallback(
    async ({ email, password }) => {
      setStatus('loading');
      try {
        const result = await authClient.login({ email, password });
        const sessionUser = result?.user ?? null;
        setUser(sessionUser);
        setStatus(sessionUser ? 'authenticated' : 'unauthenticated');
        return sessionUser;
      } catch (err) {
        setUser(null);
        setStatus('unauthenticated');
        throw err;
      }
    },
    [authClient]
  );

  const register = useCallback(
    async ({ name, email, password }) => {
      if (!allowSelfRegistration || typeof authClient.register !== 'function') {
        throw new Error('Self-registration is disabled.');
      }

      setStatus('loading');
      try {
        const result = await authClient.register({ name, email, password });
        const sessionUser = result?.user ?? null;
        setUser(sessionUser);
        setStatus(sessionUser ? 'authenticated' : 'unauthenticated');
        return sessionUser;
      } catch (err) {
        setUser(null);
        setStatus('unauthenticated');
        throw err;
      }
    },
    [allowSelfRegistration, authClient]
  );

  const logout = useCallback(async () => {
    setStatus('loading');
    try {
      await authClient.logout();
      setUser(null);
      setStatus('unauthenticated');
    } catch (err) {
      setStatus(user ? 'authenticated' : 'unauthenticated');
      throw err;
    }
  }, [authClient, user]);

  const value = useMemo(
    () => ({ user, status, allowSelfRegistration, login, logout, register, refreshSession }),
    [user, status, allowSelfRegistration, login, logout, register, refreshSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

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

function Layout() {
  const { user, logout } = useSession();
  const isAdmin = user?.role === 'Admin';
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
              <li>
                <Link to="/dashboard" className={layoutStyles.navLink}>
                  Dashboard
                </Link>
              </li>
              {isAdmin && (
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
                  <li>
                    <Link to="/users" className={layoutStyles.navLink}>
                      Users
                    </Link>
                  </li>
                </>
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

function RequireAuth() {
  const location = useLocation();
  const { status } = useSession();

  if (status === 'loading') {
    return <LoadingView message="Checking session…" />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function RequireAdmin({ children }) {
  const { user } = useSession();
  const location = useLocation();

  if (user?.role !== 'Admin') {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
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

function AppRoutes() {
  const { allowSelfRegistration } = useSession();

  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route
            path="hosts"
            element={
              <RequireAdmin>
                <HostsListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="hosts/new"
            element={
              <RequireAdmin>
                <HostFormPage mode="create" />
              </RequireAdmin>
            }
          />
          <Route
            path="hosts/:hostId"
            element={
              <RequireAdmin>
                <HostFormPage mode="edit" />
              </RequireAdmin>
            }
          />
          <Route
            path="groups"
            element={
              <RequireAdmin>
                <GroupsListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="groups/new"
            element={
              <RequireAdmin>
                <GroupFormPage mode="create" />
              </RequireAdmin>
            }
          />
          <Route
            path="groups/:groupId"
            element={
              <RequireAdmin>
                <GroupFormPage mode="edit" />
              </RequireAdmin>
            }
          />
          <Route
            path="users"
            element={
              <RequireAdmin>
                <UsersListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="users/new"
            element={
              <RequireAdmin>
                <UserFormPage mode="create" />
              </RequireAdmin>
            }
          />
          <Route
            path="users/:userId"
            element={
              <RequireAdmin>
                <UserFormPage mode="edit" />
              </RequireAdmin>
            }
          />
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
        <Route
          path="register"
          element={
            allowSelfRegistration ? (
              <RequireGuest>
                <RegisterPage />
              </RequireGuest>
            ) : (
              <Navigate to="login" replace />
            )
          }
        />
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
