import http from 'node:http';
import path from 'node:path';

import request from 'supertest';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../server/app.js';
import { ROLE_ADMIN, ROLE_MANAGER, ROLE_NONE, ROLE_VIEWER } from '../shared/roles.js';

const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'correct-password';

let hashedPassword;

beforeAll(async () => {
  hashedPassword = await bcrypt.hash(TEST_PASSWORD, 4);
});

function createMockSupervisordClient({ processSnapshots } = {}) {
  const snapshots =
    Array.isArray(processSnapshots) && processSnapshots.length > 0
      ? processSnapshots
      : [[{ name: 'app', group: 'app', state: 1 }]];
  let snapshotIndex = 0;

  const getAllProcessInfo = jest.fn((callback) => {
    const snapshot = snapshotIndex < snapshots.length ? snapshots[snapshotIndex] : snapshots.at(-1);
    snapshotIndex += 1;
    callback(null, snapshot);
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

async function createTestApp({ userRole = ROLE_ADMIN, supervisordClientOptions, host: hostOverride } = {}) {
  const host = {
    idHost: 'alpha',
    idGroup: null,
    Name: 'Test Host',
    Url: 'http://host-1',
    GroupName: null,
    override: null,
    ...(hostOverride ?? {})
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

  const client = createMockSupervisordClient(supervisordClientOptions);
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

async function fetchCsrfToken(agent) {
  const response = await agent.get('/api/auth/session');
  expect(response.status).toBe(200);
  const token = response.body?.data?.csrfToken;
  expect(typeof token).toBe('string');
  return token;
}

async function postWithCsrf(agent, url, payload) {
  const token = await fetchCsrfToken(agent);
  const requestBuilder = agent.post(url).set('x-csrf-token', token);
  return payload === undefined ? requestBuilder : requestBuilder.send(payload);
}

async function putWithCsrf(agent, url, payload) {
  const token = await fetchCsrfToken(agent);
  return agent.put(url).set('x-csrf-token', token).send(payload);
}

async function deleteWithCsrf(agent, url) {
  const token = await fetchCsrfToken(agent);
  return agent.delete(url).set('x-csrf-token', token);
}

async function login(agent, email = TEST_EMAIL, password = TEST_PASSWORD) {
  const response = await postWithCsrf(agent, '/api/auth/login', { email, password });

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

  it('rejects login attempts without a CSRF token', async () => {
    const { app } = await createTestApp();
    const agent = request.agent(app);

    const response = await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ status: 'error', error: { message: 'Invalid CSRF token' } });
  });

  it('throttles repeated login attempts from the same client', async () => {
    const { app } = await createTestApp();
    const agent = request.agent(app);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(agent, TEST_EMAIL, 'bad-password');
      expect(response.status).toBe(401);
    }

    const csrfToken = await fetchCsrfToken(agent);
    const throttledResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: TEST_EMAIL, password: 'bad-password' });

    expect(throttledResponse.status).toBe(429);
    expect(throttledResponse.body).toEqual({
      status: 'error',
      error: { message: 'Too many login attempts. Please try again later.' }
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
          role: ROLE_ADMIN
        }
      }
    });

    const response = await agent.get('/api/v1/supervisors');
    expect(response.status).toBe(200);
    expect(client.getAllProcessInfo).toHaveBeenCalledTimes(1);
    const payload = response.body;
    expect(payload.status).toBe('success');
    const entry = payload.data?.[host.idHost];
    expect(entry).toBeDefined();
    expect(entry?.data).toEqual([{ name: 'app', group: 'app', state: 1 }]);
    expect(entry?.host).toEqual(
      expect.objectContaining({
        idHost: host.idHost,
        idGroup: host.idGroup,
        Name: host.Name,
        GroupName: host.GroupName,
        Url: host.Url
      })
    );
    expect(entry?.host).not.toHaveProperty('override');
  });

  it('omits override credentials from supervisor responses', async () => {
    const hostOverride = {
      Url: 'http://user:secret@host-1/RPC2',
      override: {
        Url: 'http://user:secret@host-1/RPC2',
        connection: {
          username: 'user',
          password: 'secret',
          socketPath: '/tmp/supervisor.sock'
        }
      }
    };

    const { app, client, host } = await createTestApp({ host: hostOverride });
    const agent = request.agent(app);

    await login(agent);

    const response = await agent.get('/api/v1/supervisors');
    expect(response.status).toBe(200);
    expect(client.getAllProcessInfo).toHaveBeenCalledTimes(1);

    const entry = response.body.data?.[host.idHost];
    expect(entry).toBeDefined();
    expect(entry?.host).toEqual(
      expect.objectContaining({
        idHost: host.idHost,
        Url: 'http://host-1/RPC2'
      })
    );
    expect(entry?.host.Url).not.toContain('user');
    expect(entry?.host.Url).not.toContain('secret');
    expect(entry?.host).not.toHaveProperty('override');
  });

  it('allows managers to manage infrastructure endpoints', async () => {
    const { app, hostRepository } = await createTestApp({ userRole: ROLE_MANAGER });
    const agent = request.agent(app);

    await login(agent);

    hostRepository.listHosts.mockResolvedValueOnce([]);
    const response = await agent.get('/api/v1/hosts');
    expect(response.status).toBe(200);
  });

  it('prevents viewers from modifying infrastructure', async () => {
    const { app, hostRepository } = await createTestApp({ userRole: ROLE_VIEWER });
    const agent = request.agent(app);

    await login(agent);

    const response = await agent.get('/api/v1/hosts');
    expect(response.status).toBe(403);
    expect(hostRepository.listHosts).not.toHaveBeenCalled();
  });

  it('allows viewers to read supervisor state but blocks control actions', async () => {
    const { app, client, host } = await createTestApp({ userRole: ROLE_VIEWER });
    const agent = request.agent(app);

    await login(agent);

    const readResponse = await agent.get('/api/v1/supervisors');
    expect(readResponse.status).toBe(200);
    expect(client.getAllProcessInfo).toHaveBeenCalledTimes(1);

    const controlResponse = await postWithCsrf(agent, '/api/v1/supervisors/control', {
      host: host.idHost,
      process: 'app',
      action: 'restart'
    });
    expect(controlResponse.status).toBe(403);
  });

  it('requires an assigned role to access supervisor data', async () => {
    const { app } = await createTestApp({ userRole: ROLE_NONE });
    const agent = request.agent(app);

    await login(agent);

    const response = await agent.get('/api/v1/supervisors');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'error',
      error: { message: 'Insufficient privileges' }
    });
  });

  it('allows administrators to control supervisord processes', async () => {
    const { app, client, host } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    const response = await postWithCsrf(agent, '/api/v1/supervisors/control', {
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

    const clearResponse = await postWithCsrf(agent, '/api/v1/supervisors/logs/clear', {
      host: host.idHost,
      process: 'app'
    });

    expect(clearResponse.status).toBe(200);
    expect(client.clearProcessLogs).toHaveBeenCalledWith('app', expect.any(Function));
    expect(clearResponse.body).toEqual({
      status: 'success',
      data: ['', 0, false]
    });
  });

  it('destroys the session and clears the configured cookie on logout', async () => {
    const { app } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    const response = await postWithCsrf(agent, '/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: { user: null } });

    const cookies = response.headers['set-cookie'] ?? [];
    expect(cookies.some((cookie) => cookie.startsWith('test.sid=;'))).toBe(true);

    const sessionResponse = await agent.get('/api/auth/session');
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toEqual({
      status: 'success',
      data: {
        user: null,
        csrfToken: expect.any(String),
        allowSelfRegistration: expect.any(Boolean)
      }
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

    const createResponse = await postWithCsrf(agent, '/api/v1/hosts', {
      name: 'New Host',
      url: 'http://new-host'
    });
    expect(createResponse.status).toBe(201);
    expect(hostRepository.createHost).toHaveBeenCalledWith({ name: 'New Host', url: 'http://new-host', groupId: null });
    expect(hostCache.refresh).toHaveBeenCalled();

    const deleteResponse = await deleteWithCsrf(agent, '/api/v1/hosts/6');
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

    const response = await putWithCsrf(agent, '/api/v1/groups/3', { name: 'Production' });
    expect(response.status).toBe(200);
    expect(groupRepository.updateGroup).toHaveBeenCalledWith(3, { name: 'Production' });
    expect(response.body).toEqual({ status: 'success', data: { id: 3, name: 'Production' } });
  });

  it('creates users through the API with hashed passwords', async () => {
    const { app, userRepository } = await createTestApp();
    const agent = request.agent(app);

    await login(agent);

    userRepository.createUser.mockImplementation(async (input) => ({ id: 9, ...input, passwordHash: undefined }));

    const response = await postWithCsrf(agent, '/api/v1/users', {
      name: 'CLI User',
      email: 'cli@example.test',
      role: ROLE_VIEWER,
      password: 'temporary'
    });

    expect(response.status).toBe(201);
    const payload = userRepository.createUser.mock.calls[0][0];
    expect(payload).toMatchObject({ name: 'CLI User', email: 'cli@example.test', role: ROLE_VIEWER });
    expect(await bcrypt.compare('temporary', payload.passwordHash)).toBe(true);
  });

  it('streams incremental supervisor updates', async () => {
    const processSnapshots = [
      [{ name: 'app', group: 'app', state: 1 }],
      [{ name: 'app', group: 'app', state: 0 }]
    ];

    const { app, host } = await createTestApp({
      supervisordClientOptions: { processSnapshots }
    });

    const agent = request.agent(app);
    const loginResponse = await login(agent);

    const setCookieHeader = loginResponse.headers['set-cookie'];
    const sessionCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader.find((value) => value.startsWith('test.sid='))
      : setCookieHeader;

    expect(typeof sessionCookie).toBe('string');
    const cookieHeader = sessionCookie.split(';')[0];

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    const { port } = server.address();
    const events = [];

    try {
      await new Promise((resolve, reject) => {
        let resolved = false;

        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/api/v1/supervisors/stream?interval=20',
            headers: {
              Accept: 'text/event-stream',
              Cookie: cookieHeader
            },
            method: 'GET'
          },
          (res) => {
            res.setEncoding('utf8');
            let buffer = '';

            const finalize = () => {
              if (!resolved) {
                resolved = true;
                resolve();
              }
            };

            res.on('data', (chunk) => {
              buffer += chunk;
              let separatorIndex = buffer.indexOf('\n\n');
              while (separatorIndex !== -1) {
                const rawEvent = buffer.slice(0, separatorIndex);
                buffer = buffer.slice(separatorIndex + 2);
                separatorIndex = buffer.indexOf('\n\n');

                if (!rawEvent) {
                  continue;
                }

                const lines = rawEvent.split('\n');
                let eventType = 'message';
                const dataLines = [];

                for (const line of lines) {
                  if (line.startsWith('event:')) {
                    eventType = line.slice(6).trim();
                  } else if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trim());
                  }
                }

                if (dataLines.length === 0) {
                  continue;
                }

                const dataPayload = dataLines.join('\n');
                events.push({ event: eventType, data: dataPayload });

                if (events.some((entry) => entry.event === 'snapshot') && events.some((entry) => entry.event === 'update')) {
                  res.destroy();
                  finalize();
                  return;
                }
              }
            });

            res.on('close', finalize);
            res.on('end', finalize);
            res.on('error', (err) => {
              if (!resolved) {
                reject(err);
              }
            });
          }
        );

        req.on('error', (err) => {
          if (!resolved) {
            reject(err);
          }
        });
        req.end();
      });

      const snapshotEvent = events.find((entry) => entry.event === 'snapshot');
      expect(snapshotEvent).toBeDefined();
      const snapshotData = JSON.parse(snapshotEvent.data);
      expect(snapshotData).toEqual({
        [host.idHost]: {
          host: expect.objectContaining({
            idHost: host.idHost,
            Url: host.Url
          }),
          data: processSnapshots[0]
        }
      });
      expect(snapshotData?.[host.idHost]?.host).not.toHaveProperty('override');

      const updateEvent = events.find((entry) => entry.event === 'update');
      expect(updateEvent).toBeDefined();
      const updateData = JSON.parse(updateEvent.data);
      expect(updateData).toEqual({
        updates: {
          [host.idHost]: {
            host: expect.objectContaining({
              idHost: host.idHost,
              Url: host.Url
            }),
            data: processSnapshots[1]
          }
        },
        removed: []
      });
      expect(updateData?.updates?.[host.idHost]?.host).not.toHaveProperty('override');
    } finally {
      server.close();
    }
  });
});
