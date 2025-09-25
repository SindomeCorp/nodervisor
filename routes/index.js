import { Router } from 'express';

import { ajax_supervisorctl } from './ajax_supervisorctl.js';
import { ajax_supervisord } from './ajax_supervisord.js';
import { ajax_supervisorlog } from './ajax_supervisorlog.js';
import { dashboard } from './dashboard.js';
import { groups } from './groups.js';
import { hosts } from './hosts.js';
import { log } from './log.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { supervisord } from './supervisord.js';
import { users } from './users.js';

export function createRouter(params) {
  const router = Router();

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

  router.get('/ajax/supervisorctl', ajax_supervisorctl(params));
  router.get('/ajax/supervisord', ajax_supervisord(params));
  router.get('/ajax/supervisorlog', ajax_supervisorlog(params));

  return router;
}
