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
  createTable: false
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
    await context.config.warmHosts(context.db);

    const stopHostRefresh = context.config.scheduleHostRefresh(context.db, { logger: console });
    const refreshSignals = ['SIGHUP', 'SIGUSR2'];

    const handleRefreshSignal = async (signal) => {
      try {
        await context.config.refreshHosts(context.db);
        console.log(`Host cache refreshed after ${signal}`);
      } catch (refreshErr) {
        console.error(`Failed to refresh host cache after ${signal}`, refreshErr);
      }
    };

    refreshSignals.forEach((signal) => {
      process.on(signal, handleRefreshSignal);
    });

    const server = app.listen(app.get('port'), app.get('host'), () => {
      console.log(`Nodervisor launched on ${app.get('host')}:${app.get('port')}`);
    });

    const shutdown = () => {
      stopHostRefresh();
      server.close(() => process.exit(0));
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start Nodervisor', err);
    process.exit(1);
  }
}

start();

export default app;
