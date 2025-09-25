export async function requestJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (!headers.has('X-CSRF-Token')) {
    const csrfToken = getCookieValue('XSRF-TOKEN');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers
  });

  let payload;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload?.data ?? payload;
}

function getCookieValue(name) {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

export function createAuthClient(endpoints = {}) {
  const {
    session = '/api/auth/session',
    login = '/api/auth/login',
    logout = '/api/auth/logout',
    register = '/api/auth/register'
  } = endpoints ?? {};

  return {
    getSession() {
      return requestJson(session);
    },
    login(credentials) {
      return requestJson(login, {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
    },
    logout() {
      return requestJson(logout, {
        method: 'POST'
      });
    },
    register(payload) {
      return requestJson(register, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  };
}
