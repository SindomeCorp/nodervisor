/**
 * Shared type definitions for the Nodervisor backend.
 * These typedef exports allow other modules to consume runtime code
 * while still benefitting from rich editor hints via JSDoc.
 */

/** @typedef {import('knex').Knex} Knex */
/** @typedef {import('express').Request} ExpressRequest */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('express').NextFunction} ExpressNext */
/** @typedef {import('express-session').Store} SessionStore */

/**
 * @typedef {Object} GroupRow
 * @property {number} idGroup
 * @property {string} Name
 */
export let GroupRow;

/**
 * @typedef {Object} HostRow
 * @property {number} idHost
 * @property {string} Name
 * @property {string} Url
 * @property {number|null} [idGroup]
 * @property {string|null} [GroupName]
 */
export let HostRow;

/**
 * @typedef {Object} UserRow
 * @property {number} id
 * @property {string} Name
 * @property {string} Email
 * @property {string} Password
 * @property {string} Role
 */
export let UserRow;

/**
 * @typedef {import('express-session').Session & import('express-session').SessionData & {
 *   loggedIn?: boolean;
 *   user?: UserRow | null;
 * }} RequestSession
 */
export let RequestSession;

/**
 * @typedef {Object} HostOverrideConnection
 * @property {string} [url]
 * @property {string} [hostname]
 * @property {number} [port]
 * @property {'http' | 'https'} [protocol]
 * @property {string} [username]
 * @property {string} [password]
 * @property {string} [socketPath]
 */
export let HostOverrideConnection;

/**
 * @typedef {Object} HostOverride
 * @property {string} [Name]
 * @property {string} [GroupName]
 * @property {string} [Url]
 * @property {HostOverrideConnection} [connection]
 */
export let HostOverride;

/**
 * @typedef {HostRow & { override: HostOverride | null }} HostRecord
 */
export let HostRecord;

/**
 * @typedef {Record<string | number, HostRecord>} HostRegistry
 */
export let HostRegistry;

/**
 * @typedef {Object} SessionConfig
 * @property {string} name
 * @property {string} secret
 * @property {import('express-session').CookieOptions} cookie
 */
export let SessionConfig;

/**
 * @typedef {Object} DashboardConfig
 * @property {string} publicDir
 * @property {string} publicPath
 * @property {string} entry
 * @property {string[]} manifestFiles
 */
export let DashboardConfig;

/**
 * @typedef {Object} SupervisordDefaults
 * @property {'http' | 'https'} protocol
 * @property {string} host
 * @property {number} port
 * @property {string} [username]
 * @property {string} [password]
 * @property {string} [socketPath]
 * @property {number} [requestTimeout]
 */
export let SupervisordDefaults;

/**
 * @typedef {Object} SupervisordConfig
 * @property {SupervisordDefaults} defaults
 * @property {(host: HostRecord) => string | { socketPath: string; path?: string }} buildTarget
 * @property {(api: typeof import('supervisord'), host: HostRecord) => any} createClient
 */
export let SupervisordConfig;

/**
 * @typedef {Object} HostCache
 * @property {(db: Knex) => Promise<HostRegistry>} warm
 * @property {(db: Knex) => Promise<HostRegistry>} refresh
 * @property {(db: Knex, options?: { intervalMs?: number; logger?: Console }) => () => void} scheduleRefresh
 * @property {(id: string | number) => HostRecord | null} get
 * @property {() => HostRecord[]} getAll
 * @property {(id: string | number) => HostOverride | null} getOverride
 * @property {() => HostRegistry} toObject
 * @property {number | undefined} [defaultRefreshIntervalMs]
 * @property {Date | null | undefined} [lastRefreshedAt]
 */
export let HostCache;

/**
 * @typedef {Object} ServerConfig
 * @property {import('knex').Knex.Config} db
 * @property {import('knex').Knex.Config} sessionstore
 * @property {number|string} port
 * @property {string} host
 * @property {string} env
 * @property {string} sessionSecret
 * @property {SessionConfig} session
 * @property {DashboardConfig} dashboard
 * @property {SupervisordConfig} supervisord
 * @property {HostCache} hostCache
 * @property {(db: Knex) => Promise<HostRegistry>} warmHosts
 * @property {(db: Knex) => Promise<HostRegistry>} refreshHosts
 * @property {(db: Knex, options?: { intervalMs?: number; logger?: Console }) => () => void} scheduleHostRefresh
 * @property {(id: string | number) => HostOverride | null} getHostOverride
 */
export let ServerConfig;

/**
 * @typedef {Object} ServerContext
 * @property {ServerConfig} config
 * @property {Knex} db
 * @property {SessionStore} sessionStore
 * @property {typeof import('supervisord')} supervisordapi
 * @property {string} [version]
 */
export let ServerContext;

/**
 * @typedef {import('express').RequestHandler} RequestHandler
 */
export let RequestHandler;

/**
 * @typedef {(
 *   context: ServerContext
 * ) => RequestHandler} RouteFactory
 */
export let RouteFactory;

/**
 * @typedef {(
 *   req: ExpressRequest & { session?: RequestSession },
 *   res: ExpressResponse,
 *   next: ExpressNext
 * ) => void | Promise<void>} RouteMiddleware
 */
export let RouteMiddleware;
