import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Knex from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('server shutdown integration', () => {
  /** @type {import('../../server/index.js')} */
  let serverModule;
  /** @type {string} */
  let tempDir;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodervisor-shutdown-'));
    const databasePath = path.join(tempDir, 'application.sqlite');
    const sessionDatabasePath = path.join(tempDir, 'sessions.sqlite');

    process.env.NODE_ENV = 'test';
    process.env.DB_CLIENT = 'sqlite3';
    process.env.DB_FILENAME = databasePath;
    process.env.SESSION_DB_CLIENT = 'sqlite3';
    process.env.SESSION_DB_FILENAME = sessionDatabasePath;
    process.env.SESSION_SECRET = 'integration-secret';

    jest.resetModules();

    const { default: config } = await import('../../config.js');
    const migrationDb = Knex(config.db);
    await migrationDb.migrate.latest({
      directory: path.resolve(__dirname, '../../migrations'),
      loadExtensions: ['.cjs']
    });
    await migrationDb.destroy();

    const sessionDb = Knex(config.sessionstore);
    await sessionDb.destroy();

    serverModule = await import('../../server/index.js');
  });

  afterAll(async () => {
    if (serverModule?.shutdown) {
      await serverModule.shutdown();
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    delete process.env.DB_CLIENT;
    delete process.env.DB_FILENAME;
    delete process.env.SESSION_DB_CLIENT;
    delete process.env.SESSION_DB_FILENAME;
    delete process.env.SESSION_SECRET;
  });

  it('closes knex pools after shutdown', async () => {
    const { start, shutdown } = serverModule;
    let started;
    try {
      started = await start();
      const { app, context, shutdown: stop } = started;

      await request(app).get('/').expect(302);

      await stop();

      const dbPoolActive = context.db?.client?.pool?.numUsed?.() ?? 0;
      const sessionPoolActive = context.sessionStore?.knex?.client?.pool?.numUsed?.() ?? 0;

      expect(dbPoolActive).toBe(0);
      expect(sessionPoolActive).toBe(0);
    } finally {
      if (started) {
        await shutdown();
      }
    }
  });
});
