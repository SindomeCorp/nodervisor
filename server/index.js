import Knex from 'knex';
import { ConnectSessionKnexStore } from 'connect-session-knex';
import supervisordapi from 'supervisord';

import config from '../config.js';
import { createApp } from './app.js';
import { createServerContext } from './context.js';

const db = Knex(config.db);
const knexsessions = Knex(config.sessionstore);

const sessionStore = new ConnectSessionKnexStore({
  knex: knexsessions,
  tablename: 'sessions',
  createTable: true
});

const context = createServerContext({
  config,
  db,
  supervisordapi,
  sessionStore
});

const app = createApp(context);

async function start() {
  try {
    await context.config.readHosts(context.db);
    app.listen(app.get('port'), app.get('host'), () => {
      console.log(`Nodervisor launched on ${app.get('host')}:${app.get('port')}`);
    });
  } catch (err) {
    console.error('Failed to start Nodervisor', err);
    process.exit(1);
  }
}

start();

export default app;
