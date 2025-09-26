import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

describe('knexfile client normalization', () => {
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

    const knexConfig = (await import('../knexfile.cjs')).default;

    expect(knexConfig.production.client).toBe(expected);
  });
});
