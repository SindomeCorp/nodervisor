/*
 * GET log page
 */

import { ensureAdminRequest } from '../server/session.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * @param {ServerContext} context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function log(context) {
  const { config } = context;
  return function (req, res) {
    if (!ensureAdminRequest(req, res)) {
      return;
    }

    if (req.params.host && req.params.process) {
      const data = {};
      const host = config.hostCache?.get?.(req.params.host) ?? config.hosts?.[req.params.host];
      if (host) {
        data.host = host;
      } else {
        data.error = 'Host not found';
      }

      return res.render('log', {
        title: 'Nodervisor - Log',
        session: req.session,
        data,
        host: req.params.host,
        process: req.params.process,
        type: req.params.type
      });
    }
    return res.redirect('/');
  };
}
