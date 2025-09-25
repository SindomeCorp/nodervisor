import request from 'supertest';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../server/app.js';

const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'correct-password';

let hashedPassword;

beforeAll(async () => {
  hashedPassword = await bcrypt.hash(TEST_PASSWORD, 4);
});

function createMockSupervisordClient() {
  const getAllProcessInfo = jest.fn((callback) => {
    callback(null, [{ name: 'app', group: 'app', state: 1 }]);
  });
  const stopProcess = jest.fn((_processName, callback) => {
    callback(null, true);
  });
  const startProcess = jest.fn((_processName, callback) => {
    callback(null, true);
  });
  const stopAllProcesses = jest.fn((_wait, callback) => {
    callback(null, true);
  });
  const startAllProcesses = jest.fn((_wait, callback) => {
    callback(null, true);
  });
  const tailProcessStdoutLog = jest.fn((_processName, start, length, callback) => {
    if (length === 0) {
      callback(null, ['', 64, false]);
      return;
    }

    callback(null, ['#'.repeat(length), start + length, false]);
  });
  const tailProcessStderrLog = jest.fn((_processName, start, length, callback) => {
    if (length === 0) {
      callback(null, ['', 64, false]);
      return;
    }

    callback(null, ['#'.repeat(length), start + length, false]);
  });
  const clearProcessLogs = jest.fn((_processName, callback) => {
    callback(null, true);
  });

  return {
    getAllProcessInfo,
    stopProcess,
    startProcess,
    stopAllProcesses,
    startAllProcesses,
    tailProcessStdoutLog,
    tailProcessStderrLog,
    clearProcessLogs
  };
}

async function createTestApp({ userRole = 'Admin' } = {}) {
  const host = {
    idHost: 'alpha',
    Name: 'Test Host',
    Url: 'http://host-1'
  };

  const userRecord = {
    idUser: 1,
    Email: TEST_EMAIL,
    Password: hashedPassword,
    Role: userRole
  };

  const usersWhere = jest.fn(async (column, value) => {
    if (column === 'Email' && value === userRecord.Email) {
      return [userRecord];
    }

    return [];
  });

  const db = jest.fn((table) => {
    if (table === 'users') {
      return { where: usersWhere };
    }

    throw new Error(`Unexpected table query: ${table}`);
  });

  const client = createMockSupervisordClient();
  const supervisordapi = {
    connect: jest.fn((url) => {
      if (url !== host.Url) {
        throw new Error(`Unexpected supervisord URL: ${url}`);
      }

      return client;
    })
  };

  const context = {
    config: {
      port: 3000,
      host: '127.0.0.1',
      env: 'test',
      sessionSecret: 'test-secret',
      hosts: {
        [host.idHost]: host
      }
    },
    db,
    supervisordapi,
    sessionStore: new session.MemoryStore()
  };

  const app = createApp(context);
  app.engine('ejs', (_filePath, _options, callback) => callback(null, ''));
  app.set('view engine', 'ejs');

  return { app, client, host, userRecord, usersWhere };
}

async function login(agent, email = TEST_EMAIL, password = TEST_PASSWORD) {
  const response = await agent
    .post('/login')
    .type('form')
    .send({ submit: 'Login', email, password });

  return response;
}

describe('Nodervisor application', () => {
  it('rejects unauthenticated requests to the supervisord proxy', async () => {
    const { app } = await createTestApp();
    const response = await request(app).get('/api/v1/supervisors');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 'error',
      error: { message: 'Not authenticated' }
    });
  });

  it('prevents login when the password is incorrect', async () => {
    const { app } = await createTestApp();
    const agent = request.agent(app);

    const loginResponse = await login(agent, TEST_EMAIL, 'wrong-password');
    expect(loginResponse.status).toBe(200);

    const apiResponse = await agent.get('/api/v1/supervisors');
    expect(apiResponse.status).toBe(401);
    expect(apiResponse.body).toEqual({
      status: 'error',
      error: { message: 'Not authenticated' }
    });
  });

  it('authenticates valid users and returns process information', async () => {
    const { app, client, host } = await createTestApp();
    const agent = request.agent(app);

    const loginResponse = await login(agent);
    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe('/');

    const response = await agent.get('/api/v1/supervisors');
    expect(response.status).toBe(200);
    expect(client.getAllProcessInfo).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({
      status: 'success',
      data: {
        [host.idHost]: {
          host,
          data: [{ name: 'app', group: 'app', state: 1 }]
        }
      }
    });
  });

  it('allows administrators to control supervisord processes', async () => {
    const { app, client, host } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    const response = await agent.post('/api/v1/supervisors/control').send({
      host: host.idHost,
      process: 'app',
      action: 'restart'
    });

    expect(response.status).toBe(200);
    expect(client.stopProcess).toHaveBeenCalledWith('app', expect.any(Function));
    expect(client.startProcess).toHaveBeenCalledWith('app', expect.any(Function));
    expect(response.body).toEqual({
      status: 'success',
      data: {
        hostId: host.idHost,
        process: 'app',
        action: 'restart'
      }
    });
  });

  it('retrieves and clears supervisord process logs', async () => {
    const { app, client, host } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    const logsResponse = await agent
      .get('/api/v1/supervisors/logs')
      .query({ host: host.idHost, process: 'app', type: 'out', offset: 0, length: 10 });

    expect(logsResponse.status).toBe(200);
    expect(client.tailProcessStdoutLog).toHaveBeenCalledTimes(2);
    expect(client.tailProcessStdoutLog.mock.calls[0][0]).toBe('app');
    expect(client.tailProcessStdoutLog.mock.calls[0][1]).toBe(0);
    expect(client.tailProcessStdoutLog.mock.calls[0][2]).toBe(0);
    expect(logsResponse.body).toEqual({
      status: 'success',
      data: ['##########', 64, false]
    });

    const clearResponse = await agent
      .post('/api/v1/supervisors/logs/clear')
      .send({ host: host.idHost, process: 'app' });

    expect(clearResponse.status).toBe(200);
    expect(client.clearProcessLogs).toHaveBeenCalledWith('app', expect.any(Function));
    expect(clearResponse.body).toEqual({
      status: 'success',
      data: ['', 0, false]
    });
  });
});
