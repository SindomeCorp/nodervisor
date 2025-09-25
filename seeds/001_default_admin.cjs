/**
 * @param {import('knex')} knex
 */
exports.seed = async function seed(knex) {
  const existingAdmin = await knex('users').where('Email', 'admin@nodervisor').first();

  if (!existingAdmin) {
    await knex('users').insert({
      Name: 'Admin',
      Email: 'admin@nodervisor',
      Password: '$2a$10$OI5bfzPATM2358vQlDYKweliWYI2FyJwqsDJUMXuqaSzM.7vNa3xu',
      Role: 'Admin'
    });
  }
};
