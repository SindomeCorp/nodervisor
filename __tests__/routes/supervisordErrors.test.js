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

describe('Supervisord route error sanitization', () => {
  let app;
  let mockFetchAll;
  let ServiceErrorClass;

  beforeEach(async () => {
    jest.resetModules();
    mockFetchAll = jest.fn();

    const SupervisordServiceMock = jest.fn().mockImplementation(() => ({
      fetchAllProcessInfo: mockFetchAll,
      createProcessStream: jest.fn(() => ({
        on: jest.fn(),
        close: jest.fn(),
        removeAllListeners: jest.fn()
      })),
      controlProcess: jest.fn(),
      getProcessLog: jest.fn()
    }));

    jest.unstable_mockModule('../../services/supervisordService.js', () => ({
      SupervisordService: SupervisordServiceMock
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
});
