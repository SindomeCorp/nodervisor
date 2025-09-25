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

export function createRouter(params) {
  const router = Router();
  const supervisordService = new SupervisordService(params);

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

  const ensureLoggedIn = (req) => {
    if (!req.session?.loggedIn) {
      throw new ServiceError('Not authenticated', 401);
    }
  };

  const ensureAdmin = (req) => {
    ensureLoggedIn(req);

    if (req.session.user?.Role !== 'Admin') {
      throw new ServiceError('Insufficient privileges', 403);
    }
  };

  const parseNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  router.get('/', supervisord());
  router.get('/dashboard', dashboard());

  router
    .route('/hosts')
    .get(hosts(params))
    .post(hosts(params));

  router
    .route('/host/:idHost')
    .get(hosts(params))
    .post(hosts(params));

  router
    .route('/groups')
    .get(groups(params))
    .post(groups(params));

  router
    .route('/group/:idGroup')
    .get(groups(params))
    .post(groups(params));

  router
    .route('/users')
    .get(users(params))
    .post(users(params));

  router
    .route('/user/:idUser')
    .get(users(params))
    .post(users(params));

  router
    .route('/login')
    .get(login(params))
    .post(login(params));

  router.get('/logout', logout());

  router.get('/log/:host/:process/:type', log(params));

  router.get(
    '/api/v1/supervisors',
    handleRoute(async (req, res) => {
      ensureLoggedIn(req);
      const data = await supervisordService.fetchAllProcessInfo();
      respondSuccess(res, data);
    })
  );

  router.post(
    '/api/v1/supervisors/control',
    handleRoute(async (req, res) => {
      ensureAdmin(req);
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
      ensureAdmin(req);
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
      ensureAdmin(req);
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
