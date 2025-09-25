/**
 * Normalizes the result returned by Knex insert operations across
 * different database drivers.
 *
 * @param {unknown} insertResult
 * @param {string} idColumn
 * @returns {number | string | null}
 */
export function normalizeInsertId(insertResult, idColumn) {
  if (insertResult == null) {
    return null;
  }

  if (Array.isArray(insertResult)) {
    if (insertResult.length === 0) {
      return null;
    }

    const value = insertResult[0];
    if (typeof value === 'object' && value !== null) {
      if (idColumn in value) {
        return /** @type {any} */ (value)[idColumn];
      }

      const entries = Object.values(value);
      return entries.length > 0 ? entries[0] : null;
    }

    return value;
  }

  if (typeof insertResult === 'object') {
    const record = /** @type {Record<string, unknown>} */ (insertResult);
    if (idColumn in record) {
      return /** @type {any} */ (record[idColumn]);
    }

    const entries = Object.values(record);
    return entries.length > 0 ? /** @type {any} */ (entries[0]) : null;
  }

  return /** @type {any} */ (insertResult);
}

/**
 * Attempts to resolve the identifier of a newly inserted row.
 *
 * @param {import('knex').Knex.Transaction} trx
 * @param {string} table
 * @param {string} idColumn
 * @param {unknown} insertResult
 * @returns {Promise<number | null>}
 */
export async function resolveInsertedId(trx, table, idColumn, insertResult) {
  const normalized = normalizeInsertId(insertResult, idColumn);
  if (normalized != null && !Number.isNaN(Number(normalized))) {
    return Number(normalized);
  }

  const fallback = await trx(table).max({ id: idColumn }).first();
  if (!fallback) {
    return null;
  }

  const id = fallback.id ?? fallback[idColumn];
  return id == null || Number.isNaN(Number(id)) ? null : Number(id);
}
