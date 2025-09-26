import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createHostsApi } from '../../routes/api/hosts.js';
import { createGroupsApi } from '../../routes/api/groups.js';
import { createAuthApi } from '../../routes/api/auth.js';
import { createUsersApi } from '../../routes/api/users.js';
import { ROLE_ADMIN, ROLE_NONE, ROLE_VIEWER } from '../../shared/roles.js';
import { EmailAlreadyExistsError } from '../../data/users.js';
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_ROLE_LENGTH,
  MAX_URL_LENGTH
} from '../../shared/validation.js';

const STRONG_PASSWORD = 'ValidPass123!';
const LONG_NAME = 'a'.repeat(MAX_NAME_LENGTH + 1);
const LONG_ROLE = 'a'.repeat(MAX_ROLE_LENGTH + 1);
const EMAIL_DOMAIN = '@example.com';
const LONG_EMAIL = `${'a'.repeat(MAX_EMAIL_LENGTH - EMAIL_DOMAIN.length + 1)}${EMAIL_DOMAIN}`;
const URL_PREFIX = 'https://example.com/';
const LONG_URL = `${URL_PREFIX}${'a'.repeat(MAX_URL_LENGTH - URL_PREFIX.length + 1)}`;

describe('API validation middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hosts', () => {
    let hostRepository;
    let context;
    let app;

    beforeEach(() => {
      hostRepository = {
        listHosts: jest.fn().mockResolvedValue([]),
        getHostById: jest.fn(),
        createHost: jest.fn(),
        updateHost: jest.fn(),
        deleteHost: jest.fn()
      };

      context = {
        data: { hosts: hostRepository },
        config: { refreshHosts: jest.fn().mockResolvedValue() },
        db: {}
      };

      app = createTestApp('/hosts', createHostsApi(context));
    });

    it('creates a host using normalized payload data', async () => {
      const createdHost = { id: 1, name: 'host', url: 'http://example.test', groupId: 5 };
      hostRepository.createHost.mockResolvedValue(createdHost);

      const response = await request(app)
        .post('/hosts')
        .send({ name: '  host  ', url: ' http://example.test ', groupId: '5' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: 'success', data: createdHost });
      expect(hostRepository.createHost).toHaveBeenCalledWith({
        name: 'host',
        url: 'http://example.test',
        groupId: 5
      });
      expect(context.config.refreshHosts).toHaveBeenCalledWith(context.db);
    });

    it('responds with a validation error when payload is invalid', async () => {
      const response = await request(app).post('/hosts').send({ url: 'http://example.test' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.error.message).toBe('Name is required.');
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(hostRepository.createHost).not.toHaveBeenCalled();
    });

    it('rejects URLs with unsafe protocols', async () => {
      const response = await request(app)
        .post('/hosts')
        .send({ name: 'Malicious', url: 'javascript:alert(1)' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: 'URL must be a valid http(s) URL.' })
      });
      expect(hostRepository.createHost).not.toHaveBeenCalled();
    });

    it('rejects host names longer than the configured limit', async () => {
      const response = await request(app)
        .post('/hosts')
        .send({ name: LONG_NAME, url: 'http://example.test' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Name must be at most ${MAX_NAME_LENGTH} characters long.` })
      });
      expect(hostRepository.createHost).not.toHaveBeenCalled();
    });

    it('rejects host URLs longer than the configured limit', async () => {
      const response = await request(app)
        .post('/hosts')
        .send({ name: 'Web UI', url: LONG_URL });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `URL must be at most ${MAX_URL_LENGTH} characters long.` })
      });
      expect(hostRepository.createHost).not.toHaveBeenCalled();
    });
  });

  describe('groups', () => {
    let groupRepository;
    let context;
    let app;

    beforeEach(() => {
      groupRepository = {
        listGroups: jest.fn().mockResolvedValue([]),
        getGroupById: jest.fn(),
        createGroup: jest.fn(),
        updateGroup: jest.fn(),
        deleteGroup: jest.fn()
      };

      context = {
        data: { groups: groupRepository },
        config: { refreshHosts: jest.fn().mockResolvedValue() },
        db: {}
      };

      app = createTestApp('/groups', createGroupsApi(context));
    });

    it('creates a group when the payload is valid', async () => {
      const createdGroup = { id: 1, name: 'Admins' };
      groupRepository.createGroup.mockResolvedValue(createdGroup);

      const response = await request(app).post('/groups').send({ name: '  Admins  ' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: 'success', data: createdGroup });
      expect(groupRepository.createGroup).toHaveBeenCalledWith({ name: 'Admins' });
    });

    it('refreshes host cache immediately after updating a group', async () => {
      groupRepository.updateGroup.mockResolvedValue({ id: 4, name: 'Renamed' });

      const response = await request(app).put('/groups/4').send({ name: 'Renamed' });

      expect(response.status).toBe(200);
      expect(groupRepository.updateGroup).toHaveBeenCalledWith(4, { name: 'Renamed' });
      expect(context.config.refreshHosts).toHaveBeenCalledWith(context.db);
    });

    it('refreshes host cache immediately after deleting a group', async () => {
      groupRepository.getGroupById.mockResolvedValue({ id: 6, name: 'Deprecated' });

      const response = await request(app).delete('/groups/6');

      expect(response.status).toBe(204);
      expect(groupRepository.deleteGroup).toHaveBeenCalledWith(6);
      expect(context.config.refreshHosts).toHaveBeenCalledWith(context.db);
    });

    it('rejects invalid group identifiers', async () => {
      const response = await request(app).get('/groups/not-a-number');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: 'Invalid group id.' })
      });
    });

    it('rejects group names longer than the configured limit', async () => {
      const response = await request(app).post('/groups').send({ name: LONG_NAME });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Name must be at most ${MAX_NAME_LENGTH} characters long.` })
      });
      expect(groupRepository.createGroup).not.toHaveBeenCalled();
    });
  });

  describe('users', () => {
    let userRepository;
    let app;

    beforeEach(() => {
      userRepository = {
        listUsers: jest.fn().mockResolvedValue([]),
        getUserById: jest.fn(),
        createUser: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn()
      };

      const context = { data: { users: userRepository } };
      app = createTestApp('/users', createUsersApi(context));
    });

    it('hashes the password when creating a user', async () => {
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password');
      const createdUser = { id: 1, name: 'Admin', email: 'admin@example.com', role: ROLE_ADMIN };
      userRepository.createUser.mockResolvedValue(createdUser);

      const response = await request(app)
        .post('/users')
        .send({
          name: ' Admin ',
          email: ' admin@example.com ',
          role: ` ${ROLE_ADMIN} `,
          password: STRONG_PASSWORD
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: 'success', data: createdUser });
      expect(userRepository.createUser).toHaveBeenCalledWith({
        name: 'Admin',
        email: 'admin@example.com',
        role: ROLE_ADMIN,
        passwordHash: 'hashed-password'
      });
      hashSpy.mockRestore();
    });

    it('rejects user updates with invalid ids', async () => {
      const response = await request(app).put('/users/NaN').send({
        name: 'Test',
        email: 'test@example.com',
        role: ROLE_VIEWER
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: 'Invalid user id.' })
      });
      expect(userRepository.updateUser).not.toHaveBeenCalled();
    });

    it('requires user creation payloads to include mandatory fields', async () => {
      const response = await request(app).post('/users').send({ name: 'Missing Fields' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.error.message).toBe('Email is required.');
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('rejects user creation when the password violates the policy', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          name: 'Admin',
          email: 'admin@example.com',
          role: ROLE_ADMIN,
          password: 'weakpass'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: expect.stringMatching(/Password/) })
      });
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('rejects user creation when the name is too long', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          name: LONG_NAME,
          email: 'admin@example.com',
          role: ROLE_ADMIN,
          password: STRONG_PASSWORD
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Name must be at most ${MAX_NAME_LENGTH} characters long.` })
      });
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('rejects user creation when the email is too long', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          name: 'Admin',
          email: LONG_EMAIL,
          role: ROLE_ADMIN,
          password: STRONG_PASSWORD
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Email must be at most ${MAX_EMAIL_LENGTH} characters long.` })
      });
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('rejects user creation when the role is too long', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          name: 'Admin',
          email: 'admin@example.com',
          role: LONG_ROLE,
          password: STRONG_PASSWORD
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Role must be at most ${MAX_ROLE_LENGTH} characters long.` })
      });
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });
  });

  describe('auth', () => {
    let app;
    let userRepository;

    beforeEach(() => {
      userRepository = {
        findByEmail: jest.fn(),
        createUser: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        listUsers: jest.fn()
      };

      const context = {
        config: {
          auth: { allowSelfRegistration: true },
          session: { name: 'test.sid' }
        },
        data: { users: userRepository }
      };

      app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.session = {
          regenerate(callback) {
            callback(null);
          }
        };
        next();
      });
      app.use('/auth', createAuthApi(context));
    });

    it('allows login when the password violates the policy but matches the stored hash', async () => {
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      userRepository.findByEmail.mockResolvedValue({
        id: 1,
        name: 'Existing User',
        email: 'user@example.com',
        role: ROLE_NONE,
        passwordHash: 'stored-hash'
      });

      const response = await request(app).post('/auth/login').send({
        email: 'user@example.com',
        password: ' weakpass '
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        data: {
          user: {
            id: 1,
            name: 'Existing User',
            email: 'user@example.com',
            role: ROLE_NONE
          }
        }
      });
      expect(userRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(compareSpy).toHaveBeenCalledWith('weakpass', 'stored-hash');
      compareSpy.mockRestore();
    });

    it('allows registration when the payload satisfies the password policy', async () => {
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password');
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.createUser.mockResolvedValue({
        id: 1,
        name: 'New User',
        email: 'new@example.com',
        role: ROLE_ADMIN
      });

      const response = await request(app).post('/auth/register').send({
        name: 'New User',
        email: 'new@example.com',
        password: STRONG_PASSWORD
      });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(userRepository.createUser).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        role: ROLE_NONE,
        passwordHash: 'hashed-password'
      });
      hashSpy.mockRestore();
    });

    it('returns a conflict error when registration encounters a duplicate email', async () => {
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password');
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.createUser.mockRejectedValue(new EmailAlreadyExistsError());

      const response = await request(app).post('/auth/register').send({
        name: 'Existing User',
        email: 'duplicate@example.com',
        password: STRONG_PASSWORD
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 'error',
        error: { message: 'An account with that email already exists.' }
      });
      expect(userRepository.createUser).toHaveBeenCalled();
      hashSpy.mockRestore();
    });

    it('rejects registration when the name is too long', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ name: LONG_NAME, email: 'new@example.com', password: STRONG_PASSWORD });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Name must be at most ${MAX_NAME_LENGTH} characters long.` })
      });
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('rejects registration when the email is too long', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ name: 'New User', email: LONG_EMAIL, password: STRONG_PASSWORD });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Email must be at most ${MAX_EMAIL_LENGTH} characters long.` })
      });
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('rejects login when the email is too long', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: LONG_EMAIL, password: STRONG_PASSWORD });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: `Email must be at most ${MAX_EMAIL_LENGTH} characters long.` })
      });
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
    });
  });
});

function createTestApp(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { loggedIn: true, user: { role: 'Admin' } };
    next();
  });
  app.use(mountPath, router);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ status: 'error', error: { message: err.message } });
  });

  return app;
}
