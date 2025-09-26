import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';

import { createEventSource } from '../src/utils/createEventSource.js';

describe('createEventSource', () => {
  let originalEventSource;

  beforeEach(() => {
    originalEventSource = global.EventSource;
  });

  afterEach(() => {
    if (originalEventSource === undefined) {
      delete global.EventSource;
    } else {
      global.EventSource = originalEventSource;
    }
  });

  it('creates an EventSource with credentials when supported', () => {
    const instance = { readyState: 0 };
    const eventSourceMock = jest.fn(() => instance);
    global.EventSource = eventSourceMock;

    const result = createEventSource('/api/v1/supervisors/stream');

    expect(result).toBe(instance);
    expect(eventSourceMock).toHaveBeenCalledTimes(1);
    expect(eventSourceMock).toHaveBeenCalledWith('/api/v1/supervisors/stream', {
      withCredentials: true
    });
  });

  it('falls back to the legacy constructor signature when credentials options are not supported', () => {
    const instance = { readyState: 0 };
    const eventSourceMock = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new TypeError('Options argument is not supported');
      })
      .mockImplementation(() => instance);

    global.EventSource = eventSourceMock;

    const result = createEventSource('/api/v1/supervisors/stream');

    expect(result).toBe(instance);
    expect(eventSourceMock).toHaveBeenCalledTimes(2);
    expect(eventSourceMock).toHaveBeenNthCalledWith(1, '/api/v1/supervisors/stream', {
      withCredentials: true
    });
    expect(eventSourceMock).toHaveBeenNthCalledWith(2, '/api/v1/supervisors/stream');
  });

  it('throws a descriptive error when EventSource is unavailable', () => {
    delete global.EventSource;

    expect(() => createEventSource('/api/v1/supervisors/stream')).toThrow(
      'EventSource is not supported in this environment'
    );
  });
});
