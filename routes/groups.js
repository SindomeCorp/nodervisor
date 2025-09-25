/*
 * GET/POST groups page
 */

import { ensureAdminRequest } from '../server/session.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * @param {ServerContext} context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function groups(context) {
  const { db, config } = context;
  return async function (req, res, next) {
    if (!ensureAdminRequest(req, res)) {
      return;
    }

    try {
      if (req.body.delete !== undefined && req.params.idGroup) {
        await db('groups').where('idGroup', req.params.idGroup).del();
        await config.readHosts(db);
        return res.redirect('/groups');
      }
      if (req.body.submit !== undefined && req.params.idGroup) {
        if (req.params.idGroup === 'new') {
          await db('groups').insert({
            Name: req.body.name
          });
        } else {
          await db('groups')
            .where('idGroup', req.params.idGroup)
            .update({
              Name: req.body.name
            });
        }
        await config.readHosts(db);
        return res.redirect('/groups');
      }

      if (req.params.idGroup) {
        if (req.params.idGroup === 'new') {
          return res.render('edit_group', {
            title: 'Nodervisor - Edit Group',
            group: null,
            session: req.session
          });
        }

        const group = await db('groups')
          .where('idGroup', req.params.idGroup)
          .first();

        if (!group) {
          return res.redirect('/groups');
        }

        return res.render('edit_group', {
          title: 'Nodervisor - Edit Group',
          group,
          session: req.session
        });
      }

      const groups = await db('groups');
      return res.render('groups', {
        title: 'Nodervisor - Groups',
        groups,
        session: req.session
      });
    } catch (err) {
      return next(err);
    }
  };
}
