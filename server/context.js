import { createRequire } from 'module';

/** @typedef {import('./types.js').ServerContext} ServerContext */
/** @typedef {import('./types.js').ServerConfig} ServerConfig */
/** @typedef {import('./types.js').Knex} Knex */
/** @typedef {import('./types.js').SessionStore} SessionStore */

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

/**
 * Creates an immutable context object used by the server and route layers.
 *
 * @param {Object} params
 * @param {ServerConfig} params.config
 * @param {Knex} params.db
 * @param {SessionStore} params.sessionStore
 * @param {typeof import('supervisord')} params.supervisordapi
 * @returns {ServerContext}
 */
export function createServerContext({ config, db, sessionStore, supervisordapi }) {
  if (!config || !db || !sessionStore || !supervisordapi) {
    throw new Error('Invalid server context configuration');
  }

  return Object.freeze({
    config,
    db,
    sessionStore,
    supervisordapi,
    version: packageJson.version
  });
}
