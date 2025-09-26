import { jest } from '@jest/globals';

import { refreshSessionState, createRefreshSessionHandler } from '../../client/src/sessionContext.jsx';
import { resolveRequireAuth } from '../../client/src/routeGuards.jsx';

describe('session refresh behaviour', () => {
  it('marks the session unauthenticated when the backend returns no user', async () => {
    const authClient = { getSession: jest.fn().mockResolvedValue({ allowSelfRegistration: false, user: null }) };
    const setAllowSelfRegistration = jest.fn();
    const setUser = jest.fn();
    const setStatus = jest.fn();

    await refreshSessionState({ authClient, setAllowSelfRegistration, setUser, setStatus });

    expect(authClient.getSession).toHaveBeenCalledTimes(1);
    expect(setAllowSelfRegistration).toHaveBeenCalledWith(false);
    expect(setUser).toHaveBeenCalledWith(null);
    expect(setStatus).toHaveBeenLastCalledWith('unauthenticated');
  });
});

describe('SessionProvider refreshSession behaviour', () => {
  it('keeps the session authenticated when a background refresh encounters a non-auth error', async () => {
    const existingUser = { id: 'user-1', name: 'Existing User' };
    let currentUser = existingUser;
    let currentStatus = 'authenticated';
    const setAllowSelfRegistration = jest.fn();
    const setUser = jest.fn((value) => {
      currentUser = value;
    });
    const setStatus = jest.fn((value) => {
      currentStatus = value;
    });
    const getSession = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('network failure'), { status: 500 }));

    const refreshSession = createRefreshSessionHandler({
      authClient: { getSession },
      setAllowSelfRegistration,
      setUser,
      setStatus
    });

    await expect(refreshSession({ background: true })).rejects.toThrow('network failure');

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(setAllowSelfRegistration).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
    expect(currentUser).toEqual(existingUser);
    expect(currentStatus).toBe('authenticated');
  });
});

describe('route guard behaviour', () => {
  it('redirects unauthenticated users to the login page', () => {
    const decision = resolveRequireAuth({ status: 'unauthenticated', user: null, pathname: '/request-access' });
    expect(decision).toEqual({ type: 'redirect', to: '/auth/login' });
  });
});
