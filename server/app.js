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

/** @typedef {import('./types.js').ServerContext} ServerContext */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Constructs the primary Express application using the provided server
 * context. The context keeps configuration, database connections and other
 * shared services consistent across the backend modules.
 *
 * @param {ServerContext} context
 */
export function createApp(context) {
  const { config, sessionStore } = context;
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
      name: config.session.name,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: config.session.cookie,
      store: sessionStore
    })
  );
  app.use(stylus.middleware(path.join(projectRoot, 'public')));
  app.use(express.static(path.join(projectRoot, 'public')));

  app.locals.dashboardAssets = loadDashboardAssets(config.dashboard);

  if (app.get('env') === 'development') {
    app.use(errorhandler());
  }

  const router = createRouter(context);
  app.use(router);

  return app;
}

function loadDashboardAssets(dashboardConfig) {
  if (!dashboardConfig) {
    return null;
  }

  const manifestCandidates = dashboardConfig.manifestFiles.map((file) =>
    path.isAbsolute(file) ? file : path.join(dashboardConfig.publicDir, file)
  );

  for (const manifestPath of manifestCandidates) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const entryCandidates = [dashboardConfig.entry, 'src/main.jsx', 'main.jsx'].filter(
        Boolean
      );
      const entry = entryCandidates.reduce((result, candidate) => {
        if (result) {
          return result;
        }

        return candidate && manifest[candidate] ? manifest[candidate] : null;
      }, null);

      if (!entry) {
        return null;
      }

      const css = Array.isArray(entry.css)
        ? entry.css.map((href) => toDashboardAssetPath(dashboardConfig.publicPath, href))
        : [];

      return {
        js: toDashboardAssetPath(dashboardConfig.publicPath, entry.file),
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

function toDashboardAssetPath(publicPath, assetPath) {
  if (!assetPath) {
    return null;
  }

  const normalizedAsset = assetPath.replace(/^\/+/, '');
  const normalizedPublicPath = publicPath.endsWith('/')
    ? publicPath.slice(0, -1)
    : publicPath;

  return `${normalizedPublicPath}/${normalizedAsset}`;
}
