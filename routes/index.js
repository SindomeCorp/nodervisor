import { Router } from 'express';

import {
  SupervisordService,
  DEFAULT_PROCESS_STREAM_INTERVAL_MS,
  MAX_PROCESS_STREAM_INTERVAL_MS,
  MIN_PROCESS_STREAM_INTERVAL_MS
} from '../services/supervisordService.js';
import { ServiceError, sanitizeErrorDetails } from '../services/errors.js';
import { assertSessionRole, ensureAuthenticatedRequest, ensureRoleRequest } from '../server/session.js';
import { ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER } from '../shared/roles.js';
import { renderAppPage } from '../server/renderAppPage.js';
import { createHostsApi } from './api/hosts.js';
import { createGroupsApi } from './api/groups.js';
import { createUsersApi } from './api/users.js';
import { createAuthApi } from './api/auth.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * Builds the root router for the application, binding individual route
 * factories to the shared server context.
 *
 * @param {ServerContext} context
 */
export function createRouter(context) {
  const router = Router();
  const supervisordService = new SupervisordService(context);

  const respondSuccess = (res, data, status = 200) =>
    res.status(status).json({ status: 'success', data });

  const respondError = (res, error) => {
    const statusCode = error instanceof ServiceError && error.statusCode ? error.statusCode : 500;
    const message = error?.message ?? 'Unexpected error';
    const payload = { status: 'error', error: { message } };

    if (error instanceof ServiceError) {
      const details = sanitizeErrorDetails(error.details);
      if (details !== undefined) {
        payload.error.details = details;
      }
    }

    return res.status(statusCode).json(payload);
  };

  const handleRoute = (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      respondError(res, err);
    }
  };

  const parseNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

  const serveApp = ({ title, requiredRoles = null, requireAuth = true }) => (req, res) => {
    if (requireAuth) {
      if (Array.isArray(requiredRoles) && requiredRoles.length > 0) {
        if (!ensureRoleRequest(req, res, requiredRoles)) {
          return;
        }
      } else if (!ensureAuthenticatedRequest(req, res)) {
        return;
      }
    }
    const html = renderAppPage({
      title,
      dashboardAssets: req.app.locals.dashboardAssets,
      session: req.session,
      auth: context.config.auth
    });

    res.type('html').send(html);
  };

  router.get(['/auth', '/auth/*'], serveApp({ title: 'Nodervisor - Sign in', requireAuth: false }));
  router.get('/', serveApp({ title: 'Nodervisor - Dashboard', requiredRoles: [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER] }));
  router.get(
    '/dashboard',
    serveApp({ title: 'Nodervisor - Dashboard', requiredRoles: [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER] })
  );
  router.get(
    ['/hosts', '/hosts/*'],
    serveApp({ title: 'Nodervisor - Hosts', requiredRoles: [ROLE_ADMIN, ROLE_MANAGER] })
  );
  router.get(
    ['/groups', '/groups/*'],
    serveApp({ title: 'Nodervisor - Groups', requiredRoles: [ROLE_ADMIN, ROLE_MANAGER] })
  );
  router.get(['/users', '/users/*'], serveApp({ title: 'Nodervisor - Users', requiredRoles: [ROLE_ADMIN] }));
  router.get(
    ['/request-access', '/request-access/*'],
    serveApp({ title: 'Nodervisor - Access Required', requireAuth: true })
  );

  router.get(
    '/api/v1/supervisors',
    handleRoute(async (req, res) => {
      assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER]);
      const data = await supervisordService.fetchAllProcessInfo();
      respondSuccess(res, data);
    })
  );

  router.get(
    '/api/v1/supervisors/stream',
    handleRoute((req, res) => {
      assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER]);

      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      res.write(': stream-start\n\n');

      const requestedInterval = parseNumber(
        req.query.interval,
        DEFAULT_PROCESS_STREAM_INTERVAL_MS
      );
      const interval = clampNumber(
        requestedInterval,
        MIN_PROCESS_STREAM_INTERVAL_MS,
        MAX_PROCESS_STREAM_INTERVAL_MS
      );
      const abortController = new AbortController();
      const stream = supervisordService.createProcessStream({
        intervalMs: interval,
        signal: abortController.signal
      });

      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          abortController.abort();
        }
      }, 15000);
      if (typeof heartbeat?.unref === 'function') {
        heartbeat.unref();
      }

      const writeEvent = (event, payload) => {
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch {
          abortController.abort();
        }
      };

      stream.on('snapshot', (data) => {
        writeEvent('snapshot', data);
      });

      stream.on('update', (payload) => {
        const sanitized = {
          updates: payload?.updates ?? {},
          removed: Array.isArray(payload?.removed) ? payload.removed : []
        };

        if (Object.keys(sanitized.updates).length === 0 && sanitized.removed.length === 0) {
          return;
        }

        writeEvent('update', sanitized);
      });

      stream.on('error', (err) => {
        writeEvent('error', { message: err?.message ?? 'Stream error' });
      });

      const cleanup = () => {
        abortController.abort();
        stream.removeAllListeners();
        clearInterval(heartbeat);
      };

      req.on('close', cleanup);
      req.on('error', cleanup);
    })
  );

  router.post(
    '/api/v1/supervisors/control',
    handleRoute(async (req, res) => {
      assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
      const { host, process, action } = req.body ?? {};
      const result = await supervisordService.controlProcess({
        hostId: host,
        processName: process,
        action
      });
      respondSuccess(res, result);
    })
  );

  router.get(
    '/api/v1/supervisors/logs',
    handleRoute(async (req, res) => {
      assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
      const { host, process, type, offset, length } = req.query;
      const data = await supervisordService.getProcessLog({
        hostId: host,
        processName: process,
        type,
        offset: parseNumber(offset, 0),
        length: length !== undefined ? parseNumber(length, 16384) : 16384
      });
      respondSuccess(res, data);
    })
  );

  router.post(
    '/api/v1/supervisors/logs/clear',
    handleRoute(async (req, res) => {
      assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
      const { host, process } = req.body ?? {};
      const data = await supervisordService.getProcessLog({
        hostId: host,
        processName: process,
        type: 'clear'
      });
      respondSuccess(res, data);
    })
  );

  router.use('/api/v1/hosts', createHostsApi(context));
  router.use('/api/v1/groups', createGroupsApi(context));
  router.use('/api/v1/users', createUsersApi(context));
  router.use('/api/auth', createAuthApi(context));

  return router;
}
