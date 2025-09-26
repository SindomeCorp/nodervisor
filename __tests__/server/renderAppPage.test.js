import { renderAppPage } from '../../server/renderAppPage.js';

describe('renderAppPage', () => {
  it('escapes serialized state before embedding in HTML', () => {
    const stateWithSeparators = {
      session: {
        user: {
          name: 'before\u2028middle\u2029after',
          note: 'Contains </script and <!-- sequences'
        }
      }
    };

    const html = renderAppPage(stateWithSeparators);
    const scriptMatch = html.match(
      /<script id="app-state" type="application\/json">([^<]*)<\/script>/
    );

    expect(scriptMatch).not.toBeNull();

    const serializedState = scriptMatch?.[1] ?? '';

    expect(serializedState).toContain('\\u2028');
    expect(serializedState).toContain('\\u2029');
    expect(serializedState).toContain('\\u003c\\/script');
    expect(serializedState).toContain('\\u003c!--');

    expect(serializedState).not.toContain('\u2028');
    expect(serializedState).not.toContain('\u2029');
    expect(serializedState).not.toContain('</script');
    expect(serializedState).not.toContain('<!--');

    expect(JSON.parse(serializedState)).toEqual({
      user: {
        name: 'before\u2028middle\u2029after',
        note: 'Contains </script and <!-- sequences'
      },
      auth: {
        session: '/api/auth/session',
        login: '/api/auth/login',
        logout: '/api/auth/logout',
        register: '/api/auth/register',
        allowSelfRegistration: false
      }
    });
  });
});
