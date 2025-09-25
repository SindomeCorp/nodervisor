import knex from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { createGroupsRepository } from '../../data/groups.js';

let db;
let groupsRepository;

beforeAll(async () => {
  db = knex({
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });

  await db.schema.createTable('groups', (table) => {
    table.increments('idGroup').primary();
    table.string('Name');
  });
});

beforeEach(async () => {
  await db('groups').del();
  groupsRepository = createGroupsRepository(db);
});

afterAll(async () => {
  await db.destroy();
});

describe('groups repository', () => {
  it('creates groups with normalized casing', async () => {
    const group = await groupsRepository.createGroup({ name: 'Operators' });

    expect(group).toEqual({ id: expect.any(Number), name: 'Operators' });

    const stored = await db('groups').first();
    expect(stored.Name).toBe('Operators');
  });

  it('updates group names within a transaction', async () => {
    const group = await groupsRepository.createGroup({ name: 'Build' });

    const updated = await groupsRepository.updateGroup(group.id, { name: 'Build & Deploy' });
    expect(updated).toEqual({ id: group.id, name: 'Build & Deploy' });

    const reloaded = await groupsRepository.getGroupById(group.id);
    expect(reloaded).toEqual(updated);
  });

  it('lists and deletes groups', async () => {
    const first = await groupsRepository.createGroup({ name: 'Alpha' });
    const second = await groupsRepository.createGroup({ name: 'Beta' });

    const groups = await groupsRepository.listGroups();
    expect(groups).toEqual([first, second]);

    const deleted = await groupsRepository.deleteGroup(first.id);
    expect(deleted).toBe(1);

    const remaining = await groupsRepository.listGroups();
    expect(remaining).toEqual([second]);
  });
});
