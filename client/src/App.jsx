import { createContext, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';

import Dashboard from './Dashboard.jsx';
import HostsListPage from './pages/HostsListPage.jsx';
import HostFormPage from './pages/HostFormPage.jsx';
import GroupsListPage from './pages/GroupsListPage.jsx';
import GroupFormPage from './pages/GroupFormPage.jsx';
import UsersListPage from './pages/UsersListPage.jsx';
import UserFormPage from './pages/UserFormPage.jsx';
import './dashboard.css';

export const SessionContext = createContext({ user: null });

export function useSession() {
  return useContext(SessionContext);
}

function Layout() {
  const { user } = useSession();
  const isAdmin = user?.role === 'Admin';

  return (
    <div className="dashboard-app-container">
      <div className="header-container">
        <header className="header-wrapper clearfix">
          <h1 className="title">
            <Link to="/" style={{ textDecoration: 'none', color: 'white' }}>
              Nodervisor
            </Link>
          </h1>
          <nav>
            <ul>
              <li>
                <Link to="/dashboard">Dash</Link>
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
                <a href="/logout">Logout</a>
              </li>
            </ul>
          </nav>
        </header>
      </div>
      <main className="container" style={{ paddingTop: '1rem' }}>
        <Outlet />
      </main>
    </div>
  );
}

function RequireAdmin({ children }) {
  const { user } = useSession();
  const location = useLocation();

  if (user?.role !== 'Admin') {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return children;
}

export default function App({ initialState }) {
  const sessionValue = useMemo(() => ({ user: initialState?.user ?? null }), [initialState]);

  return (
    <SessionContext.Provider value={sessionValue}>
      <BrowserRouter>
        <Routes>
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
        </Routes>
      </BrowserRouter>
    </SessionContext.Provider>
  );
}
