import knex from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { createHostsRepository } from '../../data/hosts.js';

let db;
let hostsRepository;

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

  await db.schema.createTable('hosts', (table) => {
    table.increments('idHost').primary();
    table.integer('idGroup').references('idGroup').inTable('groups').onDelete('SET NULL');
    table.string('Name');
    table.string('Url');
  });
});

beforeEach(async () => {
  await db('hosts').del();
  await db('groups').del();
  hostsRepository = createHostsRepository(db);
});

afterAll(async () => {
  await db.destroy();
});

describe('hosts repository', () => {
  it('creates hosts and returns normalized records', async () => {
    const [groupId] = await db('groups').insert({ Name: 'Web Servers' });

    const host = await hostsRepository.createHost({
      name: 'frontend',
      url: 'http://frontend:9001',
      groupId
    });

    expect(host).toEqual({
      id: expect.any(Number),
      name: 'frontend',
      url: 'http://frontend:9001',
      groupId,
      groupName: 'Web Servers'
    });

    const stored = await db('hosts').first();
    expect(stored.Name).toBe('frontend');
    expect(stored.Url).toBe('http://frontend:9001');
    expect(stored.idGroup).toBe(groupId);
  });

  it('updates hosts inside a transaction and preserves relationships', async () => {
    const [groupId] = await db('groups').insert({ Name: 'API' });
    const [otherGroupId] = await db('groups').insert({ Name: 'Batch' });

    const host = await hostsRepository.createHost({
      name: 'api-1',
      url: 'http://api-1:9001',
      groupId
    });

    const updated = await hostsRepository.updateHost(host.id, {
      name: 'api-2',
      url: 'http://api-2:9001',
      groupId: otherGroupId
    });

    expect(updated).toEqual({
      id: host.id,
      name: 'api-2',
      url: 'http://api-2:9001',
      groupId: otherGroupId,
      groupName: 'Batch'
    });

    const reloaded = await hostsRepository.getHostById(host.id);
    expect(reloaded).toEqual(updated);
  });

  it('deletes hosts and returns the affected row count', async () => {
    const host = await hostsRepository.createHost({
      name: 'orphan',
      url: 'http://orphan:9001',
      groupId: null
    });

    const deleted = await hostsRepository.deleteHost(host.id);
    expect(deleted).toBe(1);

    const hosts = await hostsRepository.listHosts();
    expect(hosts).toEqual([]);
  });
});
