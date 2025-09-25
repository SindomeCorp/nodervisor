import { Router } from 'express';

import { dashboard } from './dashboard.js';
import { groups } from './groups.js';
import { hosts } from './hosts.js';
import { log } from './log.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { supervisord } from './supervisord.js';
import { users } from './users.js';
import { ServiceError, SupervisordService } from '../services/supervisordService.js';
import {
  assertSessionAdmin,
  assertSessionAuthenticated
} from '../server/session.js';

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

  router.get('/', supervisord(context));
  router.get('/dashboard', dashboard(context));

  router
    .route('/hosts')
    .get(hosts(context))
    .post(hosts(context));

  router
    .route('/host/:idHost')
    .get(hosts(context))
    .post(hosts(context));

  router
    .route('/groups')
    .get(groups(context))
    .post(groups(context));

  router
    .route('/group/:idGroup')
    .get(groups(context))
    .post(groups(context));

  router
    .route('/users')
    .get(users(context))
    .post(users(context));

  router
    .route('/user/:idUser')
    .get(users(context))
    .post(users(context));

  router
    .route('/login')
    .get(login(context))
    .post(login(context));

  router.get('/logout', logout(context));

  router.get('/log/:host/:process/:type', log(context));

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

  return router;
}
