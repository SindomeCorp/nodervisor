import { beforeEach, afterAll, describe, expect, it, jest } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

describe('config trust proxy parsing', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TRUST_PROXY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('parses numeric strings as integers', async () => {
    process.env.TRUST_PROXY = '1';

    const { default: config } = await import('../config.js');

    expect(config.trustProxy).toBe(1);
  });

  it('keeps textual booleans working', async () => {
    process.env.TRUST_PROXY = 'true';

    const { default: config } = await import('../config.js');

    expect(config.trustProxy).toBe(true);
  });
});

describe('config database client normalization', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DB_CLIENT;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it.each([
    ['MYSQL2', 'mysql2'],
    ['PostgresQL', 'pg'],
    ['SQLite3', 'sqlite3']
  ])('normalizes %s to %s', async (input, expected) => {
    process.env.DB_CLIENT = input;

    const { default: config } = await import('../config.js');

    expect(config.db.client).toBe(expected);
  });
});
