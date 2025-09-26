import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { config as loadEnvFile } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);

loadEnvironmentFiles(projectRoot);

const booleanLike = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = value.toString().trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }

    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid boolean value' });
    return z.NEVER;
  });

function integerLike() {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected integer value' });
        return z.NEVER;
      }

      return parsed;
    });
}

function trustProxyLike() {
  return z
    .union([z.boolean(), z.number(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'number') {
        if (!Number.isInteger(value) || value < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Expected a non-negative integer or boolean value'
          });
          return z.NEVER;
        }

        return value;
      }

      const normalized = value.toString().trim();
      if (!normalized) {
        return undefined;
      }

      const parsedNumber = Number(normalized);
      if (Number.isInteger(parsedNumber) && parsedNumber >= 0) {
        return parsedNumber;
      }

      const lower = normalized.toLowerCase();
      if (['true', 'yes', 'y', 'on'].includes(lower)) {
        return true;
      }

      if (['false', 'no', 'n', 'off'].includes(lower)) {
        return false;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected a non-negative integer or boolean value'
      });
      return z.NEVER;
    });
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
    ENV: z.string().optional(),
    HOST: z.string().optional(),
    PORT: integerLike(),
    SESSION_SECRET: z.string().min(8).optional(),
    DB_CLIENT: z.string().optional(),
    DB_FILENAME: z.string().optional(),
    DB_HOST: z.string().optional(),
    DB_PORT: integerLike(),
    DB_NAME: z.string().optional(),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    DB_POOL_MIN: integerLike(),
    DB_POOL_MAX: integerLike(),
    SESSION_DB_CLIENT: z.string().optional(),
    SESSION_DB_FILENAME: z.string().optional(),
    SESSION_DB_HOST: z.string().optional(),
    SESSION_DB_PORT: integerLike(),
    SESSION_DB_NAME: z.string().optional(),
    SESSION_DB_USER: z.string().optional(),
    SESSION_DB_PASSWORD: z.string().optional(),
    SESSION_DB_POOL_MIN: integerLike(),
    SESSION_DB_POOL_MAX: integerLike(),
    SESSION_COOKIE_NAME: z.string().optional(),
    SESSION_COOKIE_DOMAIN: z.string().optional(),
    SESSION_COOKIE_PATH: z.string().optional(),
    SESSION_COOKIE_MAX_AGE: integerLike(),
    SESSION_COOKIE_SECURE: booleanLike,
    SESSION_COOKIE_HTTP_ONLY: booleanLike,
    SESSION_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),
    SUPERVISORD_PROTOCOL: z.enum(['http', 'https']).optional(),
    SUPERVISORD_HOST: z.string().optional(),
    SUPERVISORD_PORT: integerLike(),
    SUPERVISORD_USERNAME: z.string().optional(),
    SUPERVISORD_PASSWORD: z.string().optional(),
    SUPERVISORD_SOCKET_PATH: z.string().optional(),
    SUPERVISORD_REQUEST_TIMEOUT: integerLike(),
    DASHBOARD_PUBLIC_DIR: z.string().optional(),
    DASHBOARD_PUBLIC_PATH: z.string().optional(),
    DASHBOARD_ENTRY: z.string().optional(),
    DASHBOARD_MANIFESTS: z.string().optional(),
    HOST_REFRESH_INTERVAL_MS: integerLike(),
    TRUST_PROXY: trustProxyLike(),
    AUTH_ALLOW_SELF_REGISTRATION: booleanLike,
    HEALTH_ENDPOINT_ENABLED: booleanLike
  })
  .passthrough();

const parsedEnv = envSchema.parse(process.env);
const environment = parsedEnv.ENV ?? parsedEnv.NODE_ENV ?? 'production';

const port = parsedEnv.PORT ?? 3000;
const host = parsedEnv.HOST ?? '127.0.0.1';

const sessionSecret = parsedEnv.SESSION_SECRET ?? crypto.randomBytes(48).toString('hex');

const sessionCookieSecure = parsedEnv.SESSION_COOKIE_SECURE ?? environment === 'production';
const sessionCookieHttpOnly = parsedEnv.SESSION_COOKIE_HTTP_ONLY ?? true;
const sessionCookieSameSite = parsedEnv.SESSION_COOKIE_SAMESITE ?? 'lax';
const sessionCookiePath = parsedEnv.SESSION_COOKIE_PATH ?? '/';
const sessionCookieMaxAge = parsedEnv.SESSION_COOKIE_MAX_AGE ?? 7 * 24 * 60 * 60 * 1000;
const sessionCookieDomain = parsedEnv.SESSION_COOKIE_DOMAIN;
const sessionCookieName = parsedEnv.SESSION_COOKIE_NAME ?? 'nv.sid';

const trustProxy = parsedEnv.TRUST_PROXY;
const authAllowSelfRegistration = parsedEnv.AUTH_ALLOW_SELF_REGISTRATION ?? false;
const healthCheckEnabled = parsedEnv.HEALTH_ENDPOINT_ENABLED ?? false;

const defaultDbFilename = path.join(projectRoot, 'nodervisor.sqlite');
const dbClient = parsedEnv.DB_CLIENT ?? 'sqlite3';
const dbFilename = parsedEnv.DB_FILENAME ?? defaultDbFilename;
const dbHost = parsedEnv.DB_HOST;
const dbPort = parsedEnv.DB_PORT;
const dbName = parsedEnv.DB_NAME;
const dbUser = parsedEnv.DB_USER;
const dbPassword = parsedEnv.DB_PASSWORD;
const dbPoolMin = parsedEnv.DB_POOL_MIN;
const dbPoolMax = parsedEnv.DB_POOL_MAX;

const dbConfig = createDatabaseConfig({
  client: dbClient,
  filename: dbFilename,
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  password: dbPassword,
  poolMin: dbPoolMin,
  poolMax: dbPoolMax
});

const sessionClient = parsedEnv.SESSION_DB_CLIENT ?? dbClient;
const sessionDbConfig = createDatabaseConfig({
  client: sessionClient,
  filename:
    parsedEnv.SESSION_DB_FILENAME ?? (sessionClient === 'sqlite3' ? dbFilename : undefined),
  host: parsedEnv.SESSION_DB_HOST ?? dbHost,
  port: parsedEnv.SESSION_DB_PORT ?? dbPort,
  database: parsedEnv.SESSION_DB_NAME ?? dbName,
  user: parsedEnv.SESSION_DB_USER ?? dbUser,
  password: parsedEnv.SESSION_DB_PASSWORD ?? dbPassword,
  poolMin: parsedEnv.SESSION_DB_POOL_MIN ?? dbPoolMin,
  poolMax: parsedEnv.SESSION_DB_POOL_MAX ?? dbPoolMax
});

const supervisordDefaults = {
  protocol: parsedEnv.SUPERVISORD_PROTOCOL ?? 'http',
  host: parsedEnv.SUPERVISORD_HOST ?? '127.0.0.1',
  port: parsedEnv.SUPERVISORD_PORT ?? 9001,
  username: parsedEnv.SUPERVISORD_USERNAME ?? undefined,
  password: parsedEnv.SUPERVISORD_PASSWORD ?? undefined,
  socketPath: parsedEnv.SUPERVISORD_SOCKET_PATH ?? undefined,
  requestTimeout: parsedEnv.SUPERVISORD_REQUEST_TIMEOUT ?? undefined
};

const dashboardConfig = createDashboardConfig({
  publicDir: parsedEnv.DASHBOARD_PUBLIC_DIR,
  publicPath: parsedEnv.DASHBOARD_PUBLIC_PATH,
  entry: parsedEnv.DASHBOARD_ENTRY,
  manifestList: parsedEnv.DASHBOARD_MANIFESTS
});

const healthCheckConfig = Object.freeze({
  enabled: healthCheckEnabled
});

class HostCache {
  constructor({ overrides, refreshIntervalMs }) {
    this.#overrides = new Map();
    for (const [key, value] of overrides.entries()) {
      this.#overrides.set(String(key), freezeHostOverride(value));
    }
    this.#hosts = new Map();
    this.defaultRefreshIntervalMs = refreshIntervalMs;
    this.lastRefreshedAt = null;
  }

  async warm(db) {
    return this.refresh(db);
  }

  async refresh(db) {
    try {
      const rows = await db('hosts')
        .leftJoin('groups', 'hosts.idGroup', 'groups.idGroup')
        .select('hosts.idHost', 'hosts.idGroup', 'hosts.Name', 'hosts.Url', 'groups.Name as GroupName');

      const next = new Map();
      for (const row of rows) {
        const id = String(row.idHost);
        const override = this.#overrides.get(id);
        const hostRecord = this.#buildHostRecord(row, override);
        next.set(id, hostRecord);
      }

      this.#hosts = next;
      this.lastRefreshedAt = new Date();
      return this.toObject();
    } catch (err) {
      this.#hosts = new Map();
      throw err;
    }
  }

  getAll() {
    return Array.from(this.#hosts.values());
  }

  get(hostId) {
    return this.#hosts.get(String(hostId)) ?? null;
  }

  has(hostId) {
    return this.#hosts.has(String(hostId));
  }

  toObject() {
    return Object.fromEntries(this.#hosts);
  }

  getOverride(hostId) {
    const override = this.#overrides.get(String(hostId));
    if (!override) {
      return null;
    }

    return cloneOverride(override);
  }

  scheduleRefresh(db, options = {}) {
    const intervalMs = options.intervalMs ?? this.defaultRefreshIntervalMs;
    if (!intervalMs || intervalMs <= 0) {
      return () => {};
    }

    const logger = options.logger ?? console;
    const timer = setInterval(() => {
      this.refresh(db).catch((err) => {
        logger.error('Failed to refresh host cache', err);
      });
    }, intervalMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    return () => clearInterval(timer);
  }

  #buildHostRecord(row, override) {
    const normalized = {
      idHost: row.idHost,
      idGroup: row.idGroup ?? null,
      Name: override?.Name ?? row.Name,
      Url: override?.Url ?? row.Url,
      GroupName: override?.GroupName ?? row.GroupName ?? null,
      override: override ? cloneOverride(override) : null
    };

    return Object.freeze(normalized);
  }

  #hosts;
  #overrides;
}

const hostOverrides = readHostOverrides(process.env);
const hostCache = new HostCache({
  overrides: hostOverrides,
  refreshIntervalMs: parsedEnv.HOST_REFRESH_INTERVAL_MS ?? 5 * 60 * 1000
});

const supervisord = createSupervisordConfig(supervisordDefaults);

const config = {
  projectRoot,
  env: environment,
  host,
  port,
  db: dbConfig,
  sessionstore: sessionDbConfig,
  session: {
    name: sessionCookieName,
    secret: sessionSecret,
    cookie: filterUndefined({
      httpOnly: sessionCookieHttpOnly,
      secure: sessionCookieSecure,
      sameSite: sessionCookieSameSite,
      path: sessionCookiePath,
      maxAge: sessionCookieMaxAge,
      domain: sessionCookieDomain
    })
  },
  trustProxy,
  sessionSecret,
  supervisord,
  dashboard: dashboardConfig,
  healthCheck: healthCheckConfig,
  auth: {
    allowSelfRegistration: authAllowSelfRegistration
  },
  hostCache,
  getHostOverride(hostId) {
    return hostCache.getOverride(hostId);
  },
  warmHosts(db) {
    return hostCache.warm(db);
  },
  refreshHosts(db) {
    return hostCache.refresh(db);
  },
  scheduleHostRefresh(db, options) {
    return hostCache.scheduleRefresh(db, options);
  }
};

Object.defineProperty(config, 'hosts', {
  get() {
    return hostCache.toObject();
  }
});

export default config;

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

    loadEnvFile({
      path: filePath,
      override: index >= 2
    });
  }
}

function createDatabaseConfig({
  client,
  filename,
  host,
  port,
  database,
  user,
  password,
  poolMin,
  poolMax
}) {
  const normalizedClient = normalizeClientName(client);

  const config = {
    client: normalizedClient
  };

  if (normalizedClient === 'sqlite3') {
    config.connection = { filename };
    config.useNullAsDefault = true;
  } else {
    config.connection = filterUndefined({
      host,
      port,
      database,
      user,
      password
    });
  }

  const poolConfig = filterUndefined({
    min: poolMin,
    max: poolMax
  });

  if (Object.keys(poolConfig).length > 0) {
    config.pool = poolConfig;
  }

  return config;
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

function createDashboardConfig({ publicDir, publicPath, entry, manifestList }) {
  const resolvedDir = resolvePath(publicDir, path.join(projectRoot, 'public', 'dashboard'));
  const manifestFiles = manifestList
    ? manifestList
        .split(',')
        .map((file) => file.trim())
        .filter(Boolean)
    : ['manifest.json', '.vite/manifest.json'];

  return {
    publicDir: resolvedDir,
    publicPath: publicPath ? normalizePublicPath(publicPath) : '/dashboard',
    entry: entry ?? 'src/main.jsx',
    manifestFiles
  };
}

function normalizePublicPath(publicPath) {
  if (!publicPath.startsWith('/')) {
    return `/${publicPath}`;
  }

  return publicPath.replace(/\/$/, '');
}

function resolvePath(candidate, fallback) {
  if (!candidate) {
    return fallback;
  }

  return path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);
}

function filterUndefined(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null)
  );
}

function freezeHostOverride(override) {
  if (!override) {
    return null;
  }

  const frozen = { ...override };
  if (override.connection) {
    frozen.connection = Object.freeze({ ...override.connection });
  }

  return Object.freeze(frozen);
}

function cloneOverride(override) {
  if (!override) {
    return null;
  }

  return {
    ...override,
    connection: override.connection ? { ...override.connection } : undefined
  };
}

function createSupervisordConfig(defaults) {
  return {
    defaults: { ...defaults },
    buildTarget(host) {
      if (!host) {
        throw new Error('Host record is required to build a supervisord target');
      }

      const override = host.override?.connection;
      const socketPath = override?.socketPath ?? defaults.socketPath;
      if (socketPath) {
        return { socketPath, path: '/RPC2' };
      }

      const baseUrl = override?.url ?? host.Url;
      const normalizedUrl = normalizeUrl(baseUrl, defaults.protocol);
      if (normalizedUrl) {
        if (override?.hostname) {
          normalizedUrl.hostname = override.hostname;
        }
        if (override?.port) {
          normalizedUrl.port = String(override.port);
        }
        if (override?.protocol) {
          normalizedUrl.protocol = `${override.protocol}:`;
        }

        const user = override?.username ?? (normalizedUrl.username || defaults.username);
        const pass = override?.password ?? (normalizedUrl.password || defaults.password);
        if (user) {
          normalizedUrl.username = user;
          normalizedUrl.password = pass ?? '';
        } else if (defaults.username) {
          normalizedUrl.username = defaults.username;
          normalizedUrl.password = defaults.password ?? '';
        }

        return trimTrailingSlash(normalizedUrl.toString());
      }

      const hostname = override?.hostname ?? defaults.host ?? host.Name ?? 'localhost';
      const protocol = override?.protocol ?? defaults.protocol ?? 'http';
      const port = override?.port ?? defaults.port;
      const username = override?.username ?? defaults.username;
      const password = override?.password ?? defaults.password;

      let auth = '';
      if (username) {
        auth = username;
        if (password) {
          auth += `:${password}`;
        }
        auth += '@';
      }

      const portSegment = port ? `:${port}` : '';
      return `${protocol}://${auth}${hostname}${portSegment}`;
    },
    createClient(supervisordApi, host) {
      const target = this.buildTarget(host);
      return supervisordApi.connect(target);
    }
  };
}

function normalizeUrl(candidate, defaultProtocol) {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate);
  } catch {
    if (!defaultProtocol) {
      return null;
    }

    try {
      return new URL(`${defaultProtocol}://${candidate}`);
    } catch {
      return null;
    }
  }
}

function trimTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function readHostOverrides(env) {
  const prefix = 'HOST_OVERRIDE_';
  const aggregated = new Map();

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(prefix) || value === undefined) {
      continue;
    }

    const remainder = key.slice(prefix.length);
    if (!remainder) {
      continue;
    }

    const [id, ...fieldParts] = remainder.split('_');
    if (!id) {
      continue;
    }

    const normalizedId = id.trim();
    if (!normalizedId) {
      continue;
    }

    const fieldKey = fieldParts.join('_');
    const bucket = aggregated.get(normalizedId) ?? {};
    if (fieldKey) {
      bucket[fieldKey] = value;
    } else {
      bucket.__direct = value;
    }
    aggregated.set(normalizedId, bucket);
  }

  const overrides = new Map();

  for (const [id, raw] of aggregated.entries()) {
    const normalized = normalizeHostOverride(id, raw);
    if (normalized) {
      overrides.set(id, normalized);
    }
  }

  return overrides;
}

const hostOverrideSchema = z
  .object({
    name: z.string().optional(),
    groupName: z.string().optional(),
    url: z.string().min(1).optional(),
    hostname: z.string().optional(),
    port: integerLike(),
    protocol: z.enum(['http', 'https']).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    socketPath: z.string().optional()
  })
  .partial();

function normalizeHostOverride(id, raw) {
  let merged = {};
  if (raw.__direct !== undefined) {
    merged = parseHostOverrideValue(String(raw.__direct), id);
  }

  for (const [key, value] of Object.entries(raw)) {
    if (key === '__direct') {
      continue;
    }

    merged[key] = value;
  }

  const canonical = canonicalizeOverrideKeys(merged);
  const parsed = hostOverrideSchema.parse(canonical);

  const normalized = {};
  if (parsed.name) {
    normalized.Name = parsed.name;
  }
  if (parsed.groupName) {
    normalized.GroupName = parsed.groupName;
  }
  if (parsed.url) {
    normalized.Url = parsed.url;
  }

  const connection = filterUndefined({
    url: parsed.url,
    hostname: parsed.hostname,
    port: parsed.port,
    protocol: parsed.protocol,
    username: parsed.username,
    password: parsed.password,
    socketPath: parsed.socketPath
  });

  if (Object.keys(connection).length > 0) {
    normalized.connection = connection;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function parseHostOverrideValue(rawValue, id) {
  const value = rawValue.trim();
  if (!value) {
    return {};
  }

  if (value.startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch (err) {
      throw new Error(`Invalid JSON for host override ${id}: ${err.message}`);
    }
  }

  return { url: value };
}

const HOST_OVERRIDE_KEY_ALIASES = {
  url: ['url', 'uri'],
  name: ['name'],
  groupName: ['group', 'groupname', 'group_name'],
  hostname: ['hostname', 'host', 'address'],
  port: ['port'],
  protocol: ['protocol', 'scheme'],
  username: ['username', 'user'],
  password: ['password', 'pass'],
  socketPath: ['socket', 'socketpath']
};

function canonicalizeOverrideKeys(source) {
  const target = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    const lower = key.toLowerCase();
    let canonicalKey = null;
    for (const [targetKey, aliases] of Object.entries(HOST_OVERRIDE_KEY_ALIASES)) {
      if (aliases.includes(lower)) {
        canonicalKey = targetKey;
        break;
      }
    }

    if (canonicalKey) {
      target[canonicalKey] = value;
    } else {
      target[key] = value;
    }
  }

  return target;
}
