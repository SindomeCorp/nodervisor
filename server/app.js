import express from 'express';
import fs from 'fs';
import path from 'path';
import favicon from 'serve-favicon';
import morgan from 'morgan';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import stylus from 'stylus';
import errorhandler from 'errorhandler';
import { fileURLToPath } from 'url';

import { createRouter } from '../routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function createApp({ config, db, supervisordapi, sessionStore }) {
  const app = express();

  app.set('port', config.port);
  app.set('host', config.host);
  app.set('views', path.join(projectRoot, 'views'));
  app.set('view engine', 'ejs');
  app.set('env', config.env);

  app.use(favicon(path.join(projectRoot, 'public', 'favicon.ico')));
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(methodOverride('_method'));
  app.use(cookieParser());
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
      store: sessionStore
    })
  );
  app.use(stylus.middleware(path.join(projectRoot, 'public')));
  app.use(express.static(path.join(projectRoot, 'public')));

  app.locals.dashboardAssets = loadDashboardAssets();

  if (app.get('env') === 'development') {
    app.use(errorhandler());
  }

  const router = createRouter({ app, config, db, supervisordapi });
  app.use(router);

  return app;
}

function loadDashboardAssets() {
  const dashboardDir = path.join(projectRoot, 'public', 'dashboard');
  const manifestCandidates = [
    path.join(dashboardDir, 'manifest.json'),
    path.join(dashboardDir, '.vite', 'manifest.json')
  ];

  for (const manifestPath of manifestCandidates) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const entry = manifest['src/main.jsx'] ?? manifest['main.jsx'];

      if (!entry) {
        return null;
      }

      const css = Array.isArray(entry.css)
        ? entry.css.map((href) => `/dashboard/${href}`)
        : [];

      return {
        js: `/dashboard/${entry.file}`,
        css
      };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Unable to load dashboard assets manifest:', err.message);
        }
        return null;
      }
    }
  }

  return null;
}
