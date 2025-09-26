import { createGroupsRepository } from '../data/groups.js';
import { createHostsRepository } from '../data/hosts.js';
import { createUsersRepository } from '../data/users.js';
import packageJson from '../package.json' assert { type: 'json' };

/** @typedef {import('./types.js').ServerContext} ServerContext */
/** @typedef {import('./types.js').ServerConfig} ServerConfig */
/** @typedef {import('./types.js').Knex} Knex */
/** @typedef {import('./types.js').SessionStore} SessionStore */

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

  const data = Object.freeze({
    hosts: createHostsRepository(db),
    groups: createGroupsRepository(db),
    users: createUsersRepository(db)
  });

  return Object.freeze({
    config,
    db,
    data,
    sessionStore,
    supervisordapi,
    version: packageJson.version
  });
}
