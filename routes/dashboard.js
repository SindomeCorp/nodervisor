/*
 * GET supervisord page
 */

import { ensureAuthenticatedRequest } from '../server/session.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * @param {ServerContext} _context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function dashboard(_context) {
  return function (req, res) {
    if (!ensureAuthenticatedRequest(req, res)) {
      return;
    }

    return res.render('dashboard', {
      title: 'Nodervisor - Dashboard',
      session: req.session,
      includeDashboardApp: true
    });
  };
}
