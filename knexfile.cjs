const fs = require('node:fs');
const path = require('node:path');

const { config: loadEnv } = require('dotenv');

const projectRoot = __dirname;

loadEnvironmentFiles(projectRoot);

const sharedConfig = {
  migrations: {
    directory: path.resolve(projectRoot, 'migrations'),
    extension: 'cjs'
  },
  seeds: {
    directory: path.resolve(projectRoot, 'seeds'),
    extension: 'cjs'
  }
};

module.exports = {
  development: buildConfig('development', {
    client: 'sqlite3',
    filename: path.resolve(projectRoot, 'nodervisor.sqlite')
  }),
  test: buildConfig('test', {
    client: 'sqlite3',
    filename: path.resolve(projectRoot, 'nodervisor.test.sqlite')
  }),
  production: buildConfig('production', {
    client: process.env.DB_CLIENT ?? 'sqlite3',
    filename: path.resolve(projectRoot, 'nodervisor.sqlite')
  })
};

function buildConfig(envName, defaults) {
  const prefix = envName === 'production' ? 'DB' : `${envName.toUpperCase()}_DB`;
  const client = normalizeClientName(
    process.env[`${prefix}_CLIENT`] ?? process.env.DB_CLIENT ?? defaults.client
  );

  const base = { ...sharedConfig, client };

  if (client === 'sqlite3') {
    const filename = resolvePath(
      process.env[`${prefix}_FILENAME`] ?? process.env.DB_FILENAME ?? defaults.filename
    );
    return {
      ...base,
      connection: { filename },
      useNullAsDefault: true
    };
  }

  const connection = filterUndefined({
    host: process.env[`${prefix}_HOST`] ?? process.env.DB_HOST,
    port: parseInteger(process.env[`${prefix}_PORT`] ?? process.env.DB_PORT),
    database: process.env[`${prefix}_NAME`] ?? process.env.DB_NAME,
    user: process.env[`${prefix}_USER`] ?? process.env.DB_USER,
    password: process.env[`${prefix}_PASSWORD`] ?? process.env.DB_PASSWORD
  });

  const pool = filterUndefined({
    min: parseInteger(process.env[`${prefix}_POOL_MIN`] ?? process.env.DB_POOL_MIN),
    max: parseInteger(process.env[`${prefix}_POOL_MAX`] ?? process.env.DB_POOL_MAX)
  });

  const config = {
    ...base,
    connection
  };

  if (Object.keys(pool).length > 0) {
    config.pool = pool;
  }

  return config;
}

function resolvePath(candidate) {
  if (!candidate) {
    return candidate;
  }

  return path.isAbsolute(candidate) ? candidate : path.resolve(projectRoot, candidate);
}

function parseInteger(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : undefined;
}

function filterUndefined(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null)
  );
}

function normalizeClientName(client) {
  if (!client) {
    return client;
  }

  const normalized = client.toLowerCase();

  if (normalized === 'mysql') {
    return 'mysql2';
  }

  if (normalized === 'postgres' || normalized === 'postgresql') {
    return 'pg';
  }

  return normalized;
}

function loadEnvironmentFiles(rootDir) {
  const envName = process.env.ENV || process.env.NODE_ENV;

  const candidates = [path.join(rootDir, '.env')];
  if (envName) {
    candidates.push(path.join(rootDir, `.env.${envName}`));
  }
  candidates.push(path.join(rootDir, '.env.local'));
  if (envName) {
    candidates.push(path.join(rootDir, `.env.${envName}.local`));
  }

  for (const [index, filePath] of candidates.entries()) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    loadEnv({
      path: filePath,
      override: index >= 2
    });
  }
}
