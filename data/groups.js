import { resolveInsertedId } from './utils.js';

/** @typedef {import('../server/types.js').Knex} Knex */
/** @typedef {import('../server/types.js').Group} Group */

/**
 * Creates a repository responsible for group persistence.
 *
 * @param {Knex} db
 */
export function createGroupsRepository(db) {
  const TABLE = 'groups';
  const ID_COLUMN = 'idGroup';

  /**
   * @param {any} row
   * @returns {Group | null}
   */
  function mapGroup(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.idGroup,
      name: row.Name
    };
  }

  return {
    /**
     * Retrieves all groups.
     *
     * @returns {Promise<Group[]>}
     */
    async listGroups() {
      const rows = await db(TABLE).select('idGroup', 'Name').orderBy(ID_COLUMN);
      return rows.map((row) => mapGroup(row)).filter(Boolean);
    },

    /**
     * Retrieves a group by its identifier.
     *
     * @param {number} id
     * @returns {Promise<Group | null>}
     */
    async getGroupById(id) {
      const row = await db(TABLE).where(ID_COLUMN, id).first();
      return mapGroup(row);
    },

    /**
     * Creates a new group.
     *
     * @param {{ name: string }} input
     * @returns {Promise<Group | null>}
     */
    async createGroup({ name }) {
      return db.transaction(async (trx) => {
        const insertResult = await trx(TABLE).insert({ Name: name });
        const id = await resolveInsertedId(trx, TABLE, ID_COLUMN, insertResult);
        if (id == null) {
          return null;
        }

        const row = await trx(TABLE).where(ID_COLUMN, id).first();
        return mapGroup(row);
      });
    },

    /**
     * Updates an existing group.
     *
     * @param {number} id
     * @param {{ name: string }} input
     * @returns {Promise<Group | null>}
     */
    async updateGroup(id, { name }) {
      return db.transaction(async (trx) => {
        await trx(TABLE).where(ID_COLUMN, id).update({ Name: name });
        const row = await trx(TABLE).where(ID_COLUMN, id).first();
        return mapGroup(row);
      });
    },

    /**
     * Deletes a group.
     *
     * @param {number} id
     * @returns {Promise<number>}
     */
    async deleteGroup(id) {
      return db.transaction((trx) => trx(TABLE).where(ID_COLUMN, id).del());
    }
  };
}
