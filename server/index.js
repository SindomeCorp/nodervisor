import { pathToFileURL } from 'node:url';

import Knex from 'knex';
import { ConnectSessionKnexStore } from 'connect-session-knex';
import supervisordapi from 'supervisord';

import config from '../config.js';
import { createApp } from './app.js';
import { createServerContext } from './context.js';
import { markRuntimeStart } from './runtimeMetrics.js';

const db = Knex(config.db);
const knexsessions = Knex(config.sessionstore);

const sessionStore = new ConnectSessionKnexStore({
  knex: knexsessions,
  tableName: 'sessions'
});

const context = createServerContext({
  config,
  db,
  supervisordapi,
  sessionStore
});

const app = createApp(context);

const refreshSignals = ['SIGHUP', 'SIGUSR2'];
const registeredSignalHandlers = new Map();

let stopHostRefresh = null;
let serverInstance = null;
let startPromise = null;
let shutdownPromise = null;

export async function start() {
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    await context.config.warmHosts(context.db);

    stopHostRefresh = context.config.scheduleHostRefresh(context.db, { logger: console });

    serverInstance = await new Promise((resolve, reject) => {
      const server = app.listen(app.get('port'), app.get('host'));
      server.once('listening', () => {
        markRuntimeStart();
        console.log(`Nodervisor launched on ${app.get('host')}:${app.get('port')}`);
        resolve(server);
      });
      server.once('error', (err) => {
        reject(err);
      });
    });

    refreshSignals.forEach((signal) => {
      registerSignalHandler(signal, async (receivedSignal) => {
        await context.config.refreshHosts(context.db);
        console.log(`Host cache refreshed after ${receivedSignal}`);
      });
    });

    registerSignalHandler('SIGINT', async (signal) => {
      await shutdown({ signal });
      if (process.exitCode === undefined) {
        process.exitCode = 0;
      }
    });

    registerSignalHandler('SIGTERM', async (signal) => {
      await shutdown({ signal });
      if (process.exitCode === undefined) {
        process.exitCode = 0;
      }
    });

    return { app, context, server: serverInstance, shutdown: () => shutdown({}) };
  })();

  try {
    return await startPromise;
  } catch (err) {
    unregisterSignalHandlers();
    if (typeof stopHostRefresh === 'function') {
      try {
        await stopHostRefresh();
      } catch (stopErr) {
        console.error('Failed to stop host refresh timer', stopErr);
      }
      stopHostRefresh = null;
    }
    startPromise = null;
    throw err;
  }
}

export async function shutdown({ signal } = {}) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    if (signal) {
      console.log(`Received ${signal}, shutting down Nodervisor`);
    }

    unregisterSignalHandlers();

    if (typeof stopHostRefresh === 'function') {
      try {
        await stopHostRefresh();
      } catch (err) {
        console.error('Failed to stop host refresh timer', err);
      }
      stopHostRefresh = null;
    }

    const tasks = [
      { label: 'HTTP server', run: () => closeServer(serverInstance) },
      { label: 'database connection', run: () => context.db?.destroy?.() }
    ];

    if (typeof knexsessions?.destroy === 'function') {
      tasks.push({ label: 'session database connection', run: () => knexsessions.destroy() });
    }

    if (typeof sessionStore.close === 'function') {
      tasks.push({ label: 'session store', run: () => sessionStore.close() });
    }

    const results = await Promise.allSettled(tasks.map((task) => task.run()));

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to close ${tasks[index].label}`, result.reason);
      }
    });

    serverInstance = null;
    startPromise = null;

    return results;
  })();

  try {
    return await shutdownPromise;
  } finally {
    shutdownPromise = null;
  }
}

function createAsyncSignalHandler(handler) {
  return async (signal) => {
    try {
      await handler(signal);
    } catch (err) {
      console.error(`Failed to handle ${signal}`, err);
    }
  };
}

function registerSignalHandler(signal, handler) {
  const wrapped = createAsyncSignalHandler(handler);
  let handlers = registeredSignalHandlers.get(signal);
  if (!handlers) {
    handlers = new Set();
    registeredSignalHandlers.set(signal, handlers);
  }
  handlers.add(wrapped);
  process.on(signal, wrapped);
}

function unregisterSignalHandlers() {
  for (const [signal, handlers] of registeredSignalHandlers.entries()) {
    for (const handler of handlers) {
      process.off(signal, handler);
    }
  }
  registeredSignalHandlers.clear();
}

function closeServer(server) {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function isMainEntry() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (isMainEntry()) {
  start().catch((err) => {
    console.error('Failed to start Nodervisor', err);
    process.exitCode = 1;
  });
}

export default app;
