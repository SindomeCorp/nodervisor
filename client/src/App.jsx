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

export const SessionContext = createContext({
  user: null,
  status: 'loading',
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
  const [user, setUser] = useState(initialState?.user ?? null);
  const [status, setStatus] = useState(initialState?.user ? 'authenticated' : 'loading');
  const initialFetchCompleted = useRef(Boolean(initialState?.user));

  const refreshSession = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await authClient.getSession();
      const sessionUser = data?.user ?? null;
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
    [authClient]
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
    () => ({ user, status, login, logout, register, refreshSession }),
    [user, status, login, logout, register, refreshSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function LoadingView({ message = 'Loading…' }) {
  return (
    <div className="d-flex justify-content-center py-5">
      <div className="text-center">
        <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true"></div>
        <p className="text-muted mb-0">{message}</p>
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
    <div className="dashboard-app-container">
      <div className="header-container">
        <header className="header-wrapper">
          <h1 className="title mb-0">
            <Link to="/" className="app-brand-link">
              Nodervisor
            </Link>
          </h1>
          <nav aria-label="Primary navigation">
            <ul className="nav-list">
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              {isAdmin && (
                <>
                  <li>
                    <Link to="/hosts">Hosts</Link>
                  </li>
                  <li>
                    <Link to="/groups">Groups</Link>
                  </li>
                  <li>
                    <Link to="/users">Users</Link>
                  </li>
                </>
              )}
              <li>
                <button
                  type="button"
                  className="btn btn-link nav-link"
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
      <main className="app-main container">
        {logoutError && (
          <div className="alert alert-danger" role="alert">
            {logoutError}
          </div>
        )}
        <Outlet />
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

export default function App({ initialState }) {
  return (
    <SessionProvider initialState={initialState}>
      <BrowserRouter>
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
                <RequireGuest>
                  <RegisterPage />
                </RequireGuest>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
