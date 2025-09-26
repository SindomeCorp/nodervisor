import { assertSafeUrl, normalizeSafeUrl } from '../shared/url.js';
import { resolveInsertedId } from './utils.js';

/** @typedef {import('../server/types.js').Knex} Knex */
/** @typedef {import('../server/types.js').Host} Host */

/**
 * Creates a repository for performing host-related database operations.
 *
 * @param {Knex} db
 */
export function createHostsRepository(db) {
  const TABLE = 'hosts';
  const ID_COLUMN = 'idHost';

  /**
   * @param {any} row
   * @returns {Host | null}
   */
  function mapHost(row) {
    if (!row) {
      return null;
    }

    const safeUrl = normalizeSafeUrl(row.Url);

    return {
      id: row.idHost,
      name: row.Name,
      url: safeUrl ?? '',
      groupId: row.idGroup ?? null,
      groupName: row.GroupName ?? null
    };
  }

  /**
   * @param {Knex | import('knex').Knex.Transaction} connection
   * @param {number} id
   */
  async function fetchHost(connection, id) {
    const row = await connection(TABLE)
      .leftJoin('groups', 'hosts.idGroup', 'groups.idGroup')
      .select(
        'hosts.idHost',
        'hosts.Name',
        'hosts.Url',
        'hosts.idGroup',
        'groups.Name as GroupName'
      )
      .where('hosts.idHost', id)
      .first();

    return mapHost(row);
  }

  return {
    /**
     * Retrieves all hosts along with their associated group names.
     *
     * @returns {Promise<Host[]>}
     */
    async listHosts() {
      const rows = await db(TABLE)
        .leftJoin('groups', 'hosts.idGroup', 'groups.idGroup')
        .select(
          'hosts.idHost',
          'hosts.Name',
          'hosts.Url',
          'hosts.idGroup',
          'groups.Name as GroupName'
        );

      return rows.map((row) => mapHost(row)).filter(Boolean);
    },

    /**
     * Retrieves a single host by its identifier.
     *
     * @param {number} id
     * @returns {Promise<Host | null>}
     */
    async getHostById(id) {
      return fetchHost(db, id);
    },

    /**
     * Creates a new host record.
     *
     * @param {{ name: string; url: string; groupId?: number | null }} input
     * @returns {Promise<Host | null>}
     */
    async createHost({ name, url, groupId = null }) {
      const safeUrl = assertSafeUrl(url);

      return db.transaction(async (trx) => {
        const insertData = {
          Name: name,
          Url: safeUrl,
          idGroup: groupId ?? null
        };

        const insertResult = await trx(TABLE).insert(insertData);
        const id = await resolveInsertedId(trx, TABLE, ID_COLUMN, insertResult);
        if (id == null) {
          return null;
        }

        return fetchHost(trx, id);
      });
    },

    /**
     * Updates an existing host record.
     *
     * @param {number} id
     * @param {{ name: string; url: string; groupId?: number | null }} input
     * @returns {Promise<Host | null>}
     */
    async updateHost(id, { name, url, groupId = null }) {
      const safeUrl = assertSafeUrl(url);

      return db.transaction(async (trx) => {
        await trx(TABLE)
          .where(ID_COLUMN, id)
          .update({
            Name: name,
            Url: safeUrl,
            idGroup: groupId ?? null
          });

        return fetchHost(trx, id);
      });
    },

    /**
     * Deletes a host.
     *
     * @param {number} id
     * @returns {Promise<number>}
     */
    async deleteHost(id) {
      return db.transaction((trx) => trx(TABLE).where(ID_COLUMN, id).del());
    }
  };
}
