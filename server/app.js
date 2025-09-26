import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import favicon from 'serve-favicon';
import morgan from 'morgan';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import errorhandler from 'errorhandler';
import helmet from 'helmet';
import csurf from 'csurf';
import { fileURLToPath } from 'node:url';

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
  app.set('env', config.env);
  app.set('trust proxy', config.trustProxy ?? false);

  app.use(favicon(path.join(projectRoot, 'public', 'favicon.ico')));
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(methodOverride('_method'));
  app.use(cookieParser());
  app.use(helmet());
  app.use(
    session({
      name: config.session.name,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: config.session.cookie,
      store: sessionStore
    })
  );
  app.use((req, res, next) => {
    if (!req.session) {
      next();
      return;
    }

    const idleTimeout = config.session.cookie?.maxAge;
    if (!idleTimeout) {
      next();
      return;
    }

    const now = Date.now();
    const lastActivity = req.session.lastActivityAt;
    if (typeof lastActivity === 'number' && now - lastActivity > idleTimeout) {
      req.session.destroy((err) => {
        if (err) {
          next(err);
          return;
        }
        res.clearCookie(config.session.name);
        next();
      });
      return;
    }

    req.session.lastActivityAt = now;
    next();
  });
  const csrfProtection = csurf({
    cookie: {
      httpOnly: true,
      sameSite: config.session.cookie?.sameSite ?? 'lax',
      secure: config.session.cookie?.secure ?? false,
      path: config.session.cookie?.path ?? '/',
      domain: config.session.cookie?.domain
    }
  });
  app.use(csrfProtection);
  app.use((req, res, next) => {
    if (typeof req.csrfToken !== 'function') {
      next();
      return;
    }

    try {
      const token = req.csrfToken();
      res.locals.csrfToken = token;
      res.set('X-CSRF-Token', token);
      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        sameSite: config.session.cookie?.sameSite ?? 'lax',
        secure: config.session.cookie?.secure ?? false,
        path: config.session.cookie?.path ?? '/',
        domain: config.session.cookie?.domain
      });
    } catch (err) {
      next(err);
      return;
    }

    next();
  });
  app.use(express.static(path.join(projectRoot, 'public')));

  app.locals.dashboardAssets = loadDashboardAssets(config.dashboard);

  if (app.get('env') === 'development') {
    app.use(errorhandler());
  }

  const router = createRouter(context);
  app.use(router);

  // Handle CSRF token validation errors consistently across the API.
  app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
      res.status(403).json({ status: 'error', error: { message: 'Invalid CSRF token' } });
      return;
    }

    next(err);
  });

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
