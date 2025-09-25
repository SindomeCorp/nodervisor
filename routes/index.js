import { Router } from 'express';

import { login } from './login.js';
import { logout } from './logout.js';
import { SupervisordService } from '../services/supervisordService.js';
import { ServiceError } from '../services/errors.js';
import {
  assertSessionAdmin,
  assertSessionAuthenticated,
  ensureAdminRequest,
  ensureAuthenticatedRequest
} from '../server/session.js';
import { renderAppPage } from '../server/renderAppPage.js';
import { createHostsApi } from './api/hosts.js';
import { createGroupsApi } from './api/groups.js';
import { createUsersApi } from './api/users.js';

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

    if (error instanceof ServiceError && error.details) {
      payload.error.details = error.details;
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

  const serveApp = ({ title, requireAdmin = false }) => (req, res) => {
    const ensure = requireAdmin ? ensureAdminRequest : ensureAuthenticatedRequest;
    if (!ensure(req, res)) {
      return;
    }

    const html = renderAppPage({
      title,
      dashboardAssets: req.app.locals.dashboardAssets,
      session: req.session
    });

    res.type('html').send(html);
  };

  router.get('/', serveApp({ title: 'Nodervisor - Dashboard' }));
  router.get('/dashboard', serveApp({ title: 'Nodervisor - Dashboard' }));
  router.get(['/hosts', '/hosts/*'], serveApp({ title: 'Nodervisor - Hosts', requireAdmin: true }));
  router.get(['/groups', '/groups/*'], serveApp({ title: 'Nodervisor - Groups', requireAdmin: true }));
  router.get(['/users', '/users/*'], serveApp({ title: 'Nodervisor - Users', requireAdmin: true }));

  router
    .route('/login')
    .get(login(context))
    .post(login(context));

  router.get('/logout', logout(context));

  router.get(
    '/api/v1/supervisors',
    handleRoute(async (req, res) => {
      assertSessionAuthenticated(req.session);
      const data = await supervisordService.fetchAllProcessInfo();
      respondSuccess(res, data);
    })
  );

  router.post(
    '/api/v1/supervisors/control',
    handleRoute(async (req, res) => {
      assertSessionAdmin(req.session);
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
      assertSessionAdmin(req.session);
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
      assertSessionAdmin(req.session);
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

  return router;
}
