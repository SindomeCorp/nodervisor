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
 * @typedef {Object<string|number, HostRow>} HostRegistry
 */
export let HostRegistry;

/**
 * @typedef {Object} ServerConfig
 * @property {import('knex').Knex.Config} db
 * @property {import('knex').Knex.Config} sessionstore
 * @property {number|string} port
 * @property {string} host
 * @property {string} env
 * @property {string} sessionSecret
 * @property {HostRegistry} hosts
 * @property {(db: Knex) => Promise<HostRegistry>} readHosts
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
