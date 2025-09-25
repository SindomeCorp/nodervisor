/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  const hasSessions = await knex.schema.hasTable('sessions');
  if (hasSessions) {
    return;
  }

  await knex.schema.createTable('sessions', (table) => {
    table.string('sid', 255).primary();
    table.text('sess').notNullable();
    table.dateTime('expired').notNullable();
    table.index(['expired'], 'sessions_expired_idx');
  });
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  const hasSessions = await knex.schema.hasTable('sessions');
  if (!hasSessions) {
    return;
  }

  await knex.schema.dropTable('sessions');
};
