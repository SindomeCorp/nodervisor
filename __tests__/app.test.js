import path from 'node:path';

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
    idGroup: null,
    Name: 'Test Host',
    Url: 'http://host-1',
    GroupName: null,
    override: null
  };

  const userRecord = {
    id: 1,
    name: 'Admin User',
    email: TEST_EMAIL,
    role: userRole,
    passwordHash: hashedPassword
  };

  const userRepository = {
    findByEmail: jest.fn(async (email) => (email === userRecord.email ? userRecord : null)),
    listUsers: jest.fn().mockResolvedValue([]),
    getUserById: jest.fn().mockResolvedValue(null),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn()
  };

  const hostRepository = {
    listHosts: jest.fn().mockResolvedValue([]),
    getHostById: jest.fn().mockResolvedValue(null),
    createHost: jest.fn(),
    updateHost: jest.fn(),
    deleteHost: jest.fn()
  };

  const groupRepository = {
    listGroups: jest.fn().mockResolvedValue([]),
    getGroupById: jest.fn().mockResolvedValue(null),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn()
  };

  const db = jest.fn();

  const client = createMockSupervisordClient();
  const supervisordapi = {
    connect: jest.fn((url) => {
      if (url !== host.Url) {
        throw new Error(`Unexpected supervisord URL: ${url}`);
      }

      return client;
    })
  };

  const hostCache = {
    warm: jest.fn(),
    refresh: jest.fn(),
    scheduleRefresh: jest.fn(() => () => {}),
    get: jest.fn((id) => (String(id) === String(host.idHost) ? host : null)),
    getAll: jest.fn(() => [host]),
    toObject: jest.fn(() => ({ [host.idHost]: host })),
    getOverride: jest.fn()
  };

  const sessionConfig = {
    name: 'test.sid',
    secret: 'test-secret',
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 86_400_000
    }
  };

  const supervisordConfig = {
    defaults: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 9001
    },
    buildTarget: jest.fn((hostRecord) => hostRecord.Url)
  };
  supervisordConfig.createClient = jest.fn((api, hostRecord) =>
    api.connect(supervisordConfig.buildTarget(hostRecord))
  );

  const config = {
    port: 3000,
    host: '127.0.0.1',
    env: 'test',
    sessionSecret: sessionConfig.secret,
    session: sessionConfig,
    dashboard: {
      publicDir: path.join(process.cwd(), 'public', 'dashboard'),
      publicPath: '/dashboard',
      entry: 'src/main.jsx',
      manifestFiles: []
    },
    supervisord: supervisordConfig,
    hostCache,
    warmHosts: hostCache.warm,
    refreshHosts: hostCache.refresh,
    scheduleHostRefresh: hostCache.scheduleRefresh,
    getHostOverride: hostCache.getOverride
  };

  Object.defineProperty(config, 'hosts', {
    get() {
      return hostCache.toObject();
    }
  });

  const context = {
    config,
    db,
    supervisordapi,
    sessionStore: new session.MemoryStore(),
    data: {
      hosts: hostRepository,
      groups: groupRepository,
      users: userRepository
    }
  };

  const app = createApp(context);

  return { app, client, host, userRecord, userRepository, hostRepository, groupRepository, hostCache, context };
}

async function login(agent, email = TEST_EMAIL, password = TEST_PASSWORD) {
  const response = await agent
    .post('/api/auth/login')
    .send({ email, password });

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
    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body).toEqual({
      status: 'error',
      error: { message: 'Invalid email or password.' }
    });

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
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toEqual({
      status: 'success',
      data: {
        user: {
          id: expect.any(Number),
          name: expect.any(String),
          email: TEST_EMAIL,
          role: 'Admin'
        }
      }
    });

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

  it('returns hosts via the JSON API', async () => {
    const { app, hostRepository } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    const hosts = [{ id: 5, name: 'API Host', url: 'http://api-host', groupId: null, groupName: null }];
    hostRepository.listHosts.mockResolvedValueOnce(hosts);

    const response = await agent.get('/api/v1/hosts');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: hosts });
  });

  it('creates and deletes hosts through the API', async () => {
    const { app, hostRepository, hostCache } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    hostRepository.createHost.mockImplementation(async (payload) => ({ id: 6, ...payload }));
    hostRepository.getHostById.mockResolvedValueOnce({ id: 6, name: 'To Remove', url: 'http://remove', groupId: null });

    const createResponse = await agent.post('/api/v1/hosts').send({ name: 'New Host', url: 'http://new-host' });
    expect(createResponse.status).toBe(201);
    expect(hostRepository.createHost).toHaveBeenCalledWith({ name: 'New Host', url: 'http://new-host', groupId: null });
    expect(hostCache.refresh).toHaveBeenCalled();

    const deleteResponse = await agent.delete('/api/v1/hosts/6');
    expect(deleteResponse.status).toBe(204);
    expect(hostRepository.deleteHost).toHaveBeenCalledWith(6);
    expect(hostCache.refresh).toHaveBeenCalledTimes(2);
  });

  it('updates groups through the API', async () => {
    const { app, groupRepository } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    groupRepository.getGroupById.mockResolvedValue({ id: 3, name: 'Staging' });
    groupRepository.updateGroup.mockResolvedValue({ id: 3, name: 'Production' });

    const response = await agent.put('/api/v1/groups/3').send({ name: 'Production' });
    expect(response.status).toBe(200);
    expect(groupRepository.updateGroup).toHaveBeenCalledWith(3, { name: 'Production' });
    expect(response.body).toEqual({ status: 'success', data: { id: 3, name: 'Production' } });
  });

  it('creates users through the API with hashed passwords', async () => {
    const { app, userRepository } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    userRepository.createUser.mockImplementation(async (input) => ({ id: 9, ...input, passwordHash: undefined }));

    const response = await agent.post('/api/v1/users').send({
      name: 'CLI User',
      email: 'cli@example.test',
      role: 'User',
      password: 'temporary'
    });

    expect(response.status).toBe(201);
    const payload = userRepository.createUser.mock.calls[0][0];
    expect(payload).toMatchObject({ name: 'CLI User', email: 'cli@example.test', role: 'User' });
    expect(await bcrypt.compare('temporary', payload.passwordHash)).toBe(true);
  });
});
