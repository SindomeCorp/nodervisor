/*
 * GET supervisord page
 */

import { ensureAdminRequest } from '../server/session.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * @param {ServerContext} _context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function supervisord(_context) {
  return function (req, res) {
    if (!ensureAdminRequest(req, res)) {
      return;
    }

    return res.render('supervisord', {
      title: 'Nodervisor - All Hosts',
      session: req.session
    });
  };
}
