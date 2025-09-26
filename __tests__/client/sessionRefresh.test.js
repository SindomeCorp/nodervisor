import { jest } from '@jest/globals';

import { refreshSessionState } from '../../client/src/sessionContext.jsx';
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

describe('route guard behaviour', () => {
  it('redirects unauthenticated users to the login page', () => {
    const decision = resolveRequireAuth({ status: 'unauthenticated', user: null, pathname: '/request-access' });
    expect(decision).toEqual({ type: 'redirect', to: '/auth/login' });
  });
});
