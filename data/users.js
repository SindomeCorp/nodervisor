import { resolveInsertedId } from './utils.js';
import { ROLE_NONE } from '../shared/roles.js';

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already exists.');
    this.name = 'EmailAlreadyExistsError';
  }
}

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
      role: row.Role ?? ROLE_NONE
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
        try {
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
        } catch (error) {
          if (isUsersEmailUniqueViolation(error)) {
            throw new EmailAlreadyExistsError();
          }

          throw error;
        }
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

        try {
          await trx(TABLE).where(ID_COLUMN, id).update(updateData);
          const row = await trx(TABLE).where(ID_COLUMN, id).first();
          return /** @type {User | null} */ (mapUser(row));
        } catch (error) {
          if (isUsersEmailUniqueViolation(error)) {
            throw new EmailAlreadyExistsError();
          }

          throw error;
        }
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

function isUsersEmailUniqueViolation(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = /** @type {{ code?: string }} */ (error).code;
  const message = typeof error.message === 'string' ? error.message : '';

  if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
    if (typeof message === 'string' && message.length > 0) {
      const normalized = message.toLowerCase();
      return normalized.includes('unique constraint failed: users.email');
    }

    return /** @type {{ errno?: number }} */ (error).errno === 19;
  }

  if (code === '23505') {
    const constraint = /** @type {{ constraint?: string }} */ (error).constraint;
    if (constraint && constraint.toLowerCase() === 'users_email_unique') {
      return true;
    }

    const detail = /** @type {{ detail?: string }} */ (error).detail;
    if (detail && detail.toLowerCase().includes('(email)')) {
      return true;
    }

    return message.toLowerCase().includes('users_email_unique');
  }

  if (code === 'ER_DUP_ENTRY' || code === 'ER_DUP_ENTRY_WITH_KEY_NAME') {
    const sqlMessage = /** @type {{ sqlMessage?: string }} */ (error).sqlMessage;
    const target = sqlMessage ?? message;
    return typeof target === 'string' && target.toLowerCase().includes("'email'");
  }

  return false;
}
