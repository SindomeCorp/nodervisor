const schema = {
  async create(db) {
    try {
      const hasUsers = await db.schema.hasTable('users');
      if (!hasUsers) {
        console.log('Building users table...');
        await db.schema.createTable('users', function (table) {
          table.increments('id').primary();
          table.string('Name', 32);
          table.string('Email', 128);
          table.string('Password', 128);
          table.string('Role', 32);
        });
        console.log('Users table created.');
        await db('users').insert({
          Name: 'Admin',
          Email: 'admin@nodervisor',
          Password: '$2a$10$OI5bfzPATM2358vQlDYKweliWYI2FyJwqsDJUMXuqaSzM.7vNa3xu',
          Role: 'Admin'
        });
        console.log('Default admin user created using email:"admin@nodervisor" and password:"admin".');
      }

      const hasHosts = await db.schema.hasTable('hosts');
      if (!hasHosts) {
        console.log('Building hosts table...');
        await db.schema.createTable('hosts', function (table) {
          table.increments('idHost').primary();
          table.integer('idGroup');
          table.string('Name', 32);
          table.string('Url', 128);
        });
        console.log('Hosts table created.');
      }

      const hasGroups = await db.schema.hasTable('groups');
      if (!hasGroups) {
        console.log('Building groups table...');
        await db.schema.createTable('groups', function (table) {
          table.increments('idGroup').primary();
          table.string('Name', 32);
        });
        console.log('Groups table created.');
      }
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
};

export default schema;
