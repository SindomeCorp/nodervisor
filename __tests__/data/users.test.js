import knex from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { createUsersRepository, EmailAlreadyExistsError } from '../../data/users.js';
import { ROLE_ADMIN, ROLE_MANAGER, ROLE_NONE, ROLE_VIEWER } from '../../shared/roles.js';

let db;
let usersRepository;

beforeAll(async () => {
  db = knex({
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });

  await db.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('Name');
    table.string('Email').notNullable().unique();
    table.string('Password');
    table.string('Role');
  });
});

beforeEach(async () => {
  await db('users').del();
  usersRepository = createUsersRepository(db);
});

afterAll(async () => {
  await db.destroy();
});

describe('users repository', () => {
  it('creates users with hashed passwords and normalized casing', async () => {
    const user = await usersRepository.createUser({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      passwordHash: 'hashed',
      role: ROLE_ADMIN
    });

    expect(user).toEqual({
      id: expect.any(Number),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: ROLE_ADMIN
    });

    const stored = await db('users').first();
    expect(stored.Password).toBe('hashed');
  });

  it('finds users by email including password hashes', async () => {
    await usersRepository.createUser({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      passwordHash: 'hashed-password',
      role: ROLE_VIEWER
    });

    const user = await usersRepository.findByEmail('grace@example.com');
    expect(user).toEqual({
      id: expect.any(Number),
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: ROLE_VIEWER,
      passwordHash: 'hashed-password'
    });
  });

  it('updates users and preserves password when not provided', async () => {
    const user = await usersRepository.createUser({
      name: 'Linus Torvalds',
      email: 'linus@example.com',
      passwordHash: 'initial',
      role: ROLE_NONE
    });

    const updated = await usersRepository.updateUser(user.id, {
      name: 'Linus',
      email: 'linus@example.com',
      role: ROLE_MANAGER
    });

    expect(updated).toEqual({
      id: user.id,
      name: 'Linus',
      email: 'linus@example.com',
      role: ROLE_MANAGER
    });

    const stored = await db('users').where('id', user.id).first();
    expect(stored.Password).toBe('initial');
  });

  it('updates the password hash when provided', async () => {
    const user = await usersRepository.createUser({
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      passwordHash: 'before',
      role: ROLE_ADMIN
    });

    await usersRepository.updateUser(user.id, {
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      role: ROLE_ADMIN,
      passwordHash: 'after'
    });

    const stored = await db('users').where('id', user.id).first();
    expect(stored.Password).toBe('after');
  });

  it('rejects duplicate emails during creation', async () => {
    await usersRepository.createUser({
      name: 'Existing User',
      email: 'dupe@example.com',
      passwordHash: 'secret',
      role: ROLE_VIEWER
    });

    await expect(
      usersRepository.createUser({
        name: 'Another User',
        email: 'dupe@example.com',
        passwordHash: 'secret',
        role: ROLE_MANAGER
      })
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('rejects duplicate emails during update', async () => {
    const first = await usersRepository.createUser({
      name: 'First User',
      email: 'first@example.com',
      passwordHash: 'secret',
      role: ROLE_VIEWER
    });

    const second = await usersRepository.createUser({
      name: 'Second User',
      email: 'second@example.com',
      passwordHash: 'secret',
      role: ROLE_MANAGER
    });

    await expect(
      usersRepository.updateUser(second.id, {
        name: second.name,
        email: first.email,
        role: second.role
      })
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('deletes users', async () => {
    const user = await usersRepository.createUser({
      name: 'Barbara Liskov',
      email: 'barbara@example.com',
      passwordHash: 'secret',
      role: ROLE_VIEWER
    });

    const deleted = await usersRepository.deleteUser(user.id);
    expect(deleted).toBe(1);

    const users = await usersRepository.listUsers();
    expect(users).toEqual([]);
  });
});
