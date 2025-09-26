const PLACEHOLDER_DOMAIN = 'placeholder.local';
const UNIQUE_INDEX_NAME = 'users_Email_unique';

function buildPlaceholderEmail(prefix, id) {
  return `${prefix}_${id}@${PLACEHOLDER_DOMAIN}`;
}

function isSqlite(trx) {
  const clientName = trx.client.config.client;
  return clientName === 'sqlite3' || clientName === 'better-sqlite3';
}

/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  await knex.transaction(async (trx) => {
    const usersWithNullEmail = await trx('users').whereNull('Email');
    for (const user of usersWithNullEmail) {
      await trx('users')
        .where('id', user.id)
        .update({ Email: buildPlaceholderEmail('user', user.id) });
    }

    const duplicates = await trx('users')
      .select('Email')
      .whereNotNull('Email')
      .groupBy('Email')
      .having(trx.raw('count(*)'), '>', 1);

    for (const duplicate of duplicates) {
      const emailValue = duplicate.Email ?? duplicate.email;
      if (!emailValue) {
        continue;
      }

      const rows = await trx('users').where('Email', emailValue).orderBy('id');
      for (const [index, row] of rows.entries()) {
        if (index === 0) {
          continue;
        }

        await trx('users')
          .where('id', row.id)
          .update({ Email: buildPlaceholderEmail('duplicate', row.id) });
      }
    }

    const hasUsersTable = await trx.schema.hasTable('users');
    if (!hasUsersTable) {
      return;
    }

    if (isSqlite(trx)) {
      await trx.schema.createTable('_users_new', (table) => {
        table.increments('id').primary();
        table.string('Name', 32);
        table.string('Email', 128).notNullable().unique();
        table.string('Password', 128);
        table.string('Role', 32);
      });

      const users = await trx('users').select('id', 'Name', 'Email', 'Password', 'Role');
      if (users.length > 0) {
        await trx('_users_new').insert(users);
      }

      await trx.schema.dropTable('users');
      await trx.schema.renameTable('_users_new', 'users');
      return;
    }

    await trx.schema.alterTable('users', (table) => {
      table.string('Email', 128).notNullable().alter();
    });

    await trx.schema.alterTable('users', (table) => {
      table.unique(['Email'], UNIQUE_INDEX_NAME);
    });
  });
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  await knex.transaction(async (trx) => {
    const hasUsersTable = await trx.schema.hasTable('users');
    if (!hasUsersTable) {
      return;
    }

    if (isSqlite(trx)) {
      await trx.schema.createTable('_users_old', (table) => {
        table.increments('id').primary();
        table.string('Name', 32);
        table.string('Email', 128);
        table.string('Password', 128);
        table.string('Role', 32);
      });

      const users = await trx('users').select('id', 'Name', 'Email', 'Password', 'Role');
      if (users.length > 0) {
        await trx('_users_old').insert(users);
      }

      await trx.schema.dropTable('users');
      await trx.schema.renameTable('_users_old', 'users');
      return;
    }

    await trx.schema.alterTable('users', (table) => {
      table.dropUnique(['Email'], UNIQUE_INDEX_NAME);
    });

    await trx.schema.alterTable('users', (table) => {
      table.string('Email', 128).nullable().alter();
    });
  });
};
