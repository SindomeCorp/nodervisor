/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  const hasGroups = await knex.schema.hasTable('groups');
  if (!hasGroups) {
    await knex.schema.createTable('groups', (table) => {
      table.increments('idGroup').primary();
      table.string('Name', 32);
    });
  }

  const hasHosts = await knex.schema.hasTable('hosts');
  if (!hasHosts) {
    await knex.schema.createTable('hosts', (table) => {
      table.increments('idHost').primary();
      table
        .integer('idGroup')
        .unsigned()
        .references('idGroup')
        .inTable('groups')
        .onDelete('SET NULL');
      table.string('Name', 32);
      table.string('Url', 128);
    });
  }

  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('Name', 32);
      table.string('Email', 128);
      table.string('Password', 128);
      table.string('Role', 32);
    });
  }
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    await knex.schema.dropTable('users');
  }

  const hasHosts = await knex.schema.hasTable('hosts');
  if (hasHosts) {
    await knex.schema.dropTable('hosts');
  }

  const hasGroups = await knex.schema.hasTable('groups');
  if (hasGroups) {
    await knex.schema.dropTable('groups');
  }
};
