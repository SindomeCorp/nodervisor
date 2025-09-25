const config = {
  db: {
    client: 'sqlite3',
    connection: {
      filename: './nodervisor.sqlite'
    },
    useNullAsDefault: true
  },
  sessionstore: {
    client: 'sqlite3',
    connection: {
      filename: './nv-sessions.sqlite'
    },
    useNullAsDefault: true
  },
  port: process.env.PORT || 3000,
  host: process.env.HOST || '127.0.0.1',
  env: process.env.ENV || 'production',
  sessionSecret: process.env.SECRET || '1234567890ABCDEF',
  hosts: {},
  async readHosts(db) {
    try {
      const data = await db('hosts')
        .leftJoin('groups', 'hosts.idGroup', 'groups.idGroup')
        .select('hosts.idHost', 'hosts.Name', 'hosts.Url', 'groups.Name AS GroupName');

      const hosts = {};
      for (const host of data) {
        hosts[host.idHost] = host;
      }
      this.hosts = hosts;
      return hosts;
    } catch (err) {
      console.error('Failed to read hosts from database', err);
      this.hosts = {};
      throw err;
    }
  }
};

export default config;
