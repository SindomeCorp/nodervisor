var config = {};

// Database configuration params.
// These are the connection parameters passed to our Knex db wrapper.
// Uncomment/Comment one of the below to switch between either Mysql or Sqlite.
// The format for this object is taken directly from Knex's connection object.
// Refer to the following if you wish to use PostgreSQL or connection pooling.
// http://knexjs.org/#Installation-client
// --
// Mysql Config:
//
// config.db = {
// 	client: 'mysql',
// 	connection: {
// 		host: 'localhost',
// 		user: 'root',
// 		password: '',
// 		database: 'nodervisor',
// 		charset: 'utf8',
// 	}
// };
//
// --
// We're using Sqlite by default now.
// Sqlite config:
//
config.db = {
        client: 'sqlite3',
        connection: {
                filename: './nodervisor.sqlite'
        },
        useNullAsDefault: true
};
// End of Database config

// Session storage config
// We're using Knex as with the db above, but only using sqlite and not mysql
// The express-session-knex module seems to have issues with mysql locks.
config.sessionstore = {
        client: 'sqlite3',
        connection: {
                filename: './nv-sessions.sqlite'
        },
        useNullAsDefault: true
};

// Application env config
config.port = process.env.PORT || 3000;
config.host = process.env.HOST || '127.0.0.1';
config.env = process.env.ENV || 'production';
config.sessionSecret = process.env.SECRET || '1234567890ABCDEF';

// Read and write settings
config.hosts = {};

config.readHosts = async function(db){
        try {
                const data = await db('hosts')
                        .leftJoin('groups', 'hosts.idGroup', 'groups.idGroup')
                        .select('hosts.idHost', 'hosts.Name', 'hosts.Url', 'groups.Name AS GroupName');

                const hosts = {};
                for (const host of data) {
                        hosts[host.idHost] = host;
                }
                config.hosts = hosts;
                return hosts;
        } catch (err) {
                console.error('Failed to read hosts from database', err);
                config.hosts = {};
                throw err;
        }
};

module.exports = config;
