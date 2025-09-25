import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createHostsApi } from '../../routes/api/hosts.js';
import { createGroupsApi } from '../../routes/api/groups.js';
import { createUsersApi } from '../../routes/api/users.js';

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
  });

  describe('groups', () => {
    let groupRepository;
    let app;

    beforeEach(() => {
      groupRepository = {
        listGroups: jest.fn().mockResolvedValue([]),
        getGroupById: jest.fn(),
        createGroup: jest.fn(),
        updateGroup: jest.fn(),
        deleteGroup: jest.fn()
      };

      const context = { data: { groups: groupRepository } };
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

    it('rejects invalid group identifiers', async () => {
      const response = await request(app).get('/groups/not-a-number');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        error: expect.objectContaining({ message: 'Invalid group id.' })
      });
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
      const createdUser = { id: 1, name: 'Admin', email: 'admin@example.com', role: 'Admin' };
      userRepository.createUser.mockResolvedValue(createdUser);

      const response = await request(app)
        .post('/users')
        .send({
          name: ' Admin ',
          email: ' admin@example.com ',
          role: ' Admin ',
          password: 'super-secret'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: 'success', data: createdUser });
      expect(userRepository.createUser).toHaveBeenCalledWith({
        name: 'Admin',
        email: 'admin@example.com',
        role: 'Admin',
        passwordHash: 'hashed-password'
      });
      hashSpy.mockRestore();
    });

    it('rejects user updates with invalid ids', async () => {
      const response = await request(app).put('/users/NaN').send({
        name: 'Test',
        email: 'test@example.com',
        role: 'User'
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
