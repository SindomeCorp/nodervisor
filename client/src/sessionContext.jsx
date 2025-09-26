import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { createAuthClient } from './apiClient.js';

export async function refreshSessionState({
  authClient,
  setAllowSelfRegistration,
  setUser,
  setStatus
}) {
  const data = await authClient.getSession();
  if (data && Object.prototype.hasOwnProperty.call(data, 'allowSelfRegistration')) {
    setAllowSelfRegistration(Boolean(data.allowSelfRegistration));
  }
  const sessionUser = data?.user ?? null;
  setUser(sessionUser);
  setStatus(sessionUser ? 'authenticated' : 'unauthenticated');
  return sessionUser;
}

export function createRefreshSessionHandler({
  authClient,
  setAllowSelfRegistration,
  setUser,
  setStatus
}) {
  return async ({ background = false } = {}) => {
    if (!background) {
      setStatus('loading');
    }
    try {
      return await refreshSessionState({
        authClient,
        setAllowSelfRegistration,
        setUser,
        setStatus
      });
    } catch (err) {
      const isAuthError = err?.status === 401 || err?.status === 403;
      if (!background || isAuthError) {
        setUser(null);
        setStatus('unauthenticated');
      }
      throw err;
    }
  };
}

export const SessionContext = createContext({
  user: null,
  status: 'loading',
  allowSelfRegistration: false,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
  refreshSession: async () => {}
});

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ initialState, children, authClientFactory = createAuthClient }) {
  const authClient = useMemo(
    () => authClientFactory(initialState?.auth),
    [authClientFactory, initialState]
  );
  const [user, setUser] = useState(initialState?.user ?? null);
  const [status, setStatus] = useState(initialState?.user ? 'authenticated' : 'loading');
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(
    initialState?.auth?.allowSelfRegistration ?? false
  );
  const initialUserPresentRef = useRef(Boolean(initialState?.user));
  const initialFetchCompleted = useRef(false);

  const refreshSession = useCallback(
    createRefreshSessionHandler({
      authClient,
      setAllowSelfRegistration,
      setUser,
      setStatus
    }),
    [authClient]
  );

  useEffect(() => {
    if (initialFetchCompleted.current) {
      return;
    }
    initialFetchCompleted.current = true;
    refreshSession({ background: initialUserPresentRef.current }).catch(() => {
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
      if (!allowSelfRegistration) {
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
    [authClient, allowSelfRegistration]
  );

  const logout = useCallback(
    async () => {
      setStatus('loading');
      try {
        await authClient.logout();
        setUser(null);
        setStatus('unauthenticated');
      } catch (err) {
        setStatus(user ? 'authenticated' : 'unauthenticated');
        throw err;
      }
    },
    [authClient, user]
  );

  const value = useMemo(
    () => ({
      user,
      status,
      allowSelfRegistration,
      login,
      logout,
      register,
      refreshSession
    }),
    [user, status, allowSelfRegistration, login, logout, register, refreshSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
