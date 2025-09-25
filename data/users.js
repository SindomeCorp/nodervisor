import { resolveInsertedId } from './utils.js';

/** @typedef {import('../server/types.js').Knex} Knex */
/** @typedef {import('../server/types.js').User} User */
/** @typedef {import('../server/types.js').UserWithPassword} UserWithPassword */

/**
 * Creates a repository that encapsulates user persistence operations.
 *
 * @param {Knex} db
 */
export function createUsersRepository(db) {
  const TABLE = 'users';
  const ID_COLUMN = 'id';

  /**
   * @param {any} row
   * @param {boolean} [includePassword]
   * @returns {User | UserWithPassword | null}
   */
  function mapUser(row, includePassword = false) {
    if (!row) {
      return null;
    }

    const base = {
      id: row.id,
      name: row.Name,
      email: row.Email,
      role: row.Role
    };

    if (includePassword) {
      return /** @type {UserWithPassword} */ ({ ...base, passwordHash: row.Password });
    }

    return base;
  }

  return {
    /**
     * Retrieves all users without password hashes.
     *
     * @returns {Promise<User[]>}
     */
    async listUsers() {
      const rows = await db(TABLE).select('id', 'Name', 'Email', 'Role');
      return rows.map((row) => mapUser(row)).filter(Boolean);
    },

    /**
     * Retrieves a user by its identifier.
     *
     * @param {number} id
     * @returns {Promise<User | null>}
     */
    async getUserById(id) {
      const row = await db(TABLE).where(ID_COLUMN, id).first();
      return /** @type {User | null} */ (mapUser(row));
    },

    /**
     * Finds a user by email address, including the password hash.
     *
     * @param {string} email
     * @returns {Promise<UserWithPassword | null>}
     */
    async findByEmail(email) {
      const row = await db(TABLE).where('Email', email).first();
      return /** @type {UserWithPassword | null} */ (mapUser(row, true));
    },

    /**
     * Creates a new user record.
     *
     * @param {{ name: string; email: string; passwordHash: string; role: string }} input
     * @returns {Promise<User | null>}
     */
    async createUser({ name, email, passwordHash, role }) {
      return db.transaction(async (trx) => {
        const insertResult = await trx(TABLE).insert({
          Name: name,
          Email: email,
          Password: passwordHash,
          Role: role
        });

        const id = await resolveInsertedId(trx, TABLE, ID_COLUMN, insertResult);
        if (id == null) {
          return null;
        }

        const row = await trx(TABLE).where(ID_COLUMN, id).first();
        return /** @type {User | null} */ (mapUser(row));
      });
    },

    /**
     * Updates an existing user record.
     *
     * @param {number} id
     * @param {{ name: string; email: string; role: string; passwordHash?: string | null }} input
     * @returns {Promise<User | null>}
     */
    async updateUser(id, { name, email, role, passwordHash = null }) {
      return db.transaction(async (trx) => {
        const updateData = {
          Name: name,
          Email: email,
          Role: role
        };

        if (passwordHash) {
          updateData.Password = passwordHash;
        }

        await trx(TABLE).where(ID_COLUMN, id).update(updateData);
        const row = await trx(TABLE).where(ID_COLUMN, id).first();
        return /** @type {User | null} */ (mapUser(row));
      });
    },

    /**
     * Deletes a user.
     *
     * @param {number} id
     * @returns {Promise<number>}
     */
    async deleteUser(id) {
      return db.transaction((trx) => trx(TABLE).where(ID_COLUMN, id).del());
    }
  };
}
