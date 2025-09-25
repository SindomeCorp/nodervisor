import { jest } from '@jest/globals';

import { requestJson } from '../../client/src/apiClient.js';

describe('requestJson', () => {
  const originalFetch = global.fetch;
  const originalDocument = global.document;

  beforeEach(() => {
    global.document = { cookie: 'XSRF-TOKEN=csrf-token;' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({})
    });
  });

  afterEach(() => {
    if (typeof originalDocument === 'undefined') {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('includes the CSRF token header when available', async () => {
    await requestJson('/api/test');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = fetch.mock.calls[0];
    expect(options.headers.get('X-CSRF-Token')).toBe('csrf-token');
  });

  it('does not override an existing CSRF token header', async () => {
    await requestJson('/api/test', {
      headers: {
        'X-CSRF-Token': 'provided-token'
      }
    });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.get('X-CSRF-Token')).toBe('provided-token');
  });
});
