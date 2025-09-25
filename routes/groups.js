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
  const { config, data } = context;
  const groupRepository = data.groups;
  return async function (req, res, next) {
    if (!ensureAdminRequest(req, res)) {
      return;
    }

    try {
      const { idGroup } = req.params;
      const isNewRecord = idGroup === 'new';
      const parsedGroupId = Number(idGroup);
      const groupId = !idGroup || isNewRecord || Number.isNaN(parsedGroupId) ? null : parsedGroupId;

      if (req.body.delete !== undefined && groupId !== null) {
        await groupRepository.deleteGroup(groupId);
        await config.refreshHosts(context.db);
        return res.redirect('/groups');
      }

      if (req.body.submit !== undefined && idGroup) {
        if (isNewRecord) {
          await groupRepository.createGroup({ name: req.body.name });
        } else if (groupId !== null) {
          await groupRepository.updateGroup(groupId, { name: req.body.name });
        }

        await config.refreshHosts(context.db);
        return res.redirect('/groups');
      }

      if (idGroup) {
        if (isNewRecord) {
          return res.render('edit_group', {
            title: 'Nodervisor - Edit Group',
            group: null,
            session: req.session
          });
        }

        if (groupId === null) {
          return res.redirect('/groups');
        }

        const group = await groupRepository.getGroupById(groupId);

        if (!group) {
          return res.redirect('/groups');
        }

        return res.render('edit_group', {
          title: 'Nodervisor - Edit Group',
          group,
          session: req.session
        });
      }

      const groups = await groupRepository.listGroups();
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
