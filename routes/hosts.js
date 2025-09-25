/*
 * GET/POST hosts page
 */

import { ensureAdminRequest } from '../server/session.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * @param {ServerContext} context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function hosts(context) {
  const { config, data } = context;
  const hostRepository = data.hosts;
  const groupRepository = data.groups;
  return async function (req, res, next) {
    if (!ensureAdminRequest(req, res)) {
      return;
    }

    try {
      const { idHost } = req.params;
      const isNewRecord = idHost === 'new';
      const parsedHostId = Number(idHost);
      const hostId = !idHost || isNewRecord || Number.isNaN(parsedHostId) ? null : parsedHostId;

      if (req.body.delete !== undefined && hostId !== null) {
        await hostRepository.deleteHost(hostId);
        await config.refreshHosts(context.db);
        return res.redirect('/hosts');
      }

      if (req.body.submit !== undefined && idHost) {
        const rawGroup = req.body.group;
        const parsedGroup = rawGroup && rawGroup !== 'null' ? Number(rawGroup) : null;
        const groupId = Number.isNaN(parsedGroup) ? null : parsedGroup;

        const payload = {
          name: req.body.name,
          url: req.body.url,
          groupId
        };

        if (isNewRecord) {
          await hostRepository.createHost(payload);
        } else if (hostId !== null) {
          await hostRepository.updateHost(hostId, payload);
        }

        await config.refreshHosts(context.db);
        return res.redirect('/hosts');
      }

      if (idHost) {
        const groups = await groupRepository.listGroups();

        if (isNewRecord) {
          return res.render('edit_host', {
            title: 'Nodervisor - New Host',
            host: null,
            groups,
            session: req.session
          });
        }

        if (hostId === null) {
          return res.redirect('/hosts');
        }

        const host = await hostRepository.getHostById(hostId);

        if (!host) {
          return res.redirect('/hosts');
        }

        return res.render('edit_host', {
          title: 'Nodervisor - Edit Host',
          host,
          groups,
          session: req.session
        });
      }

      const hosts = await hostRepository.listHosts();

      return res.render('hosts', {
        title: 'Nodervisor - Hosts',
        hosts,
        session: req.session
      });
    } catch (err) {
      return next(err);
    }
  };
}
