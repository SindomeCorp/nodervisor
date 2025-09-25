import knex from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { createUsersRepository } from '../../data/users.js';

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
    table.string('Email');
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
      role: 'Admin'
    });

    expect(user).toEqual({
      id: expect.any(Number),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'Admin'
    });

    const stored = await db('users').first();
    expect(stored.Password).toBe('hashed');
  });

  it('finds users by email including password hashes', async () => {
    await usersRepository.createUser({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      passwordHash: 'hashed-password',
      role: 'User'
    });

    const user = await usersRepository.findByEmail('grace@example.com');
    expect(user).toEqual({
      id: expect.any(Number),
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: 'User',
      passwordHash: 'hashed-password'
    });
  });

  it('updates users and preserves password when not provided', async () => {
    const user = await usersRepository.createUser({
      name: 'Linus Torvalds',
      email: 'linus@example.com',
      passwordHash: 'initial',
      role: 'User'
    });

    const updated = await usersRepository.updateUser(user.id, {
      name: 'Linus',
      email: 'linus@example.com',
      role: 'Admin'
    });

    expect(updated).toEqual({
      id: user.id,
      name: 'Linus',
      email: 'linus@example.com',
      role: 'Admin'
    });

    const stored = await db('users').where('id', user.id).first();
    expect(stored.Password).toBe('initial');
  });

  it('updates the password hash when provided', async () => {
    const user = await usersRepository.createUser({
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      passwordHash: 'before',
      role: 'Admin'
    });

    await usersRepository.updateUser(user.id, {
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      role: 'Admin',
      passwordHash: 'after'
    });

    const stored = await db('users').where('id', user.id).first();
    expect(stored.Password).toBe('after');
  });

  it('deletes users', async () => {
    const user = await usersRepository.createUser({
      name: 'Barbara Liskov',
      email: 'barbara@example.com',
      passwordHash: 'secret',
      role: 'User'
    });

    const deleted = await usersRepository.deleteUser(user.id);
    expect(deleted).toBe(1);

    const users = await usersRepository.listUsers();
    expect(users).toEqual([]);
  });
});
