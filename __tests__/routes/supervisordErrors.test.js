import { EventEmitter } from 'node:events';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ROLE_ADMIN } from '../../shared/roles.js';

const createLoggerMock = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  logger.child = jest.fn(() => logger);
  return logger;
};

const MIN_INTERVAL = 1000;
const MAX_INTERVAL = 60000;
const DEFAULT_INTERVAL = 5000;

describe('Supervisord route error sanitization', () => {
  let app;
  let mockFetchAll;
  let mockCreateStream;
  let ServiceErrorClass;
  let SupervisordServiceMock;

  beforeEach(async () => {
    jest.resetModules();
    mockFetchAll = jest.fn();
    mockCreateStream = jest.fn(() => ({
      on: jest.fn(),
      close: jest.fn(),
      removeAllListeners: jest.fn()
    }));

    SupervisordServiceMock = jest.fn().mockImplementation(() => ({
      fetchAllProcessInfo: mockFetchAll,
      createProcessStream: mockCreateStream,
      controlProcess: jest.fn(),
      getProcessLog: jest.fn()
    }));

    jest.unstable_mockModule('../../services/supervisordService.js', () => ({
      SupervisordService: SupervisordServiceMock,
      MIN_PROCESS_STREAM_INTERVAL_MS: MIN_INTERVAL,
      MAX_PROCESS_STREAM_INTERVAL_MS: MAX_INTERVAL,
      DEFAULT_PROCESS_STREAM_INTERVAL_MS: DEFAULT_INTERVAL
    }));

    const { createRouter } = await import('../../routes/index.js');
    ({ ServiceError: ServiceErrorClass } = await import('../../services/errors.js'));

    const context = {
      config: { auth: { allowSelfRegistration: false }, hosts: {} },
      data: {
        hosts: {
          listHosts: jest.fn().mockResolvedValue([]),
          getHostById: jest.fn(),
          createHost: jest.fn(),
          updateHost: jest.fn(),
          deleteHost: jest.fn()
        },
        groups: {
          listGroups: jest.fn().mockResolvedValue([]),
          getGroupById: jest.fn(),
          createGroup: jest.fn(),
          updateGroup: jest.fn(),
          deleteGroup: jest.fn()
        },
        users: {
          listUsers: jest.fn().mockResolvedValue([]),
          getUserById: jest.fn(),
          createUser: jest.fn(),
          updateUser: jest.fn(),
          deleteUser: jest.fn(),
          findByEmail: jest.fn()
        }
      },
      supervisordapi: {},
      logger: createLoggerMock(),
      metrics: {}
    };

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = { loggedIn: true, user: { role: ROLE_ADMIN } };
      next();
    });
    app.use(createRouter(context));
  });

  it('redacts credentials from REST error responses', async () => {
    const error = new ServiceErrorClass('failure', 502, {
      headers: {
        Authorization: 'Bearer secret-token',
        'X-Trace': 'abc123'
      }
    });

    mockFetchAll.mockRejectedValue(error);

    const response = await request(app).get('/api/v1/supervisors');

    expect(response.status).toBe(502);
    expect(response.body.status).toBe('error');
    expect(response.body.error.message).toBe('failure');
    expect(response.body.error.details.headers.Authorization).toBe('[REDACTED]');
    expect(JSON.stringify(response.body)).not.toContain('secret-token');
  });

  const findRouteHandler = (stack, path) => {
    for (const layer of stack) {
      if (layer.route?.path === path) {
        return layer.route.stack[0]?.handle ?? null;
      }

      if (layer.name === 'router' && Array.isArray(layer.handle?.stack)) {
        const nested = findRouteHandler(layer.handle.stack, path);
        if (nested) {
          return nested;
        }
      }
    }

    return null;
  };

  const getStreamRouteHandler = () => {
    const handler = findRouteHandler(app._router.stack, '/api/v1/supervisors/stream');

    if (!handler) {
      throw new Error('Stream route not found');
    }

    return handler;
  };

  const createMockResponse = () => {
    const res = {};
    res.set = jest.fn();
    res.flushHeaders = jest.fn();
    res.write = jest.fn();
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.type = jest.fn(() => res);
    res.send = jest.fn(() => res);
    return res;
  };

  const createMockRequest = (interval) => {
    const req = new EventEmitter();
    req.query = interval === undefined ? {} : { interval };
    req.session = { loggedIn: true, user: { role: ROLE_ADMIN } };
    req.app = { locals: { dashboardAssets: {} } };
    return req;
  };

  it('clamps stream intervals below the minimum', async () => {
    const handler = getStreamRouteHandler();
    const req = createMockRequest('10');
    const res = createMockResponse();

    await handler(req, res, jest.fn());

    expect(mockCreateStream).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMs: MIN_INTERVAL })
    );

    req.emit('close');
  });

  it('clamps stream intervals above the maximum', async () => {
    const handler = getStreamRouteHandler();
    const req = createMockRequest(String(MAX_INTERVAL * 2));
    const res = createMockResponse();

    await handler(req, res, jest.fn());

    expect(mockCreateStream).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMs: MAX_INTERVAL })
    );

    req.emit('close');
  });
});
