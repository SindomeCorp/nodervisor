const path = require('path');

const baseConfig = {
  client: 'sqlite3',
  connection: {
    filename: path.resolve(__dirname, 'nodervisor.sqlite')
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
    extension: 'cjs'
  },
  seeds: {
    directory: path.resolve(__dirname, 'seeds'),
    extension: 'cjs'
  }
};

module.exports = {
  development: { ...baseConfig },
  production: { ...baseConfig }
};
