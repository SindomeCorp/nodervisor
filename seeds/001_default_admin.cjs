/**
 * @param {import('knex')} knex
 */
exports.seed = async function seed(knex) {
  const existingAdmin = await knex('users').where('Email', 'admin@nodervisor').first();

  if (!existingAdmin) {
    await knex('users').insert({
      Name: 'Admin',
      Email: 'admin@nodervisor',
      Password: '$2b$10$JE/okr6K8iN2P3oQg0YLaOZ0pkKf.ZtVIaNHv7bsXw3oPmRF8eXAG',
      Role: 'Admin'
    });
  }
};
