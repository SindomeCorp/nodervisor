/*
 * GET/POST settings page
 */

import bcrypt from 'bcrypt';

import { ensureAdminRequest } from '../server/session.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * @param {ServerContext} context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function users(context) {
  const {
    data: { users: userRepository }
  } = context;
  return async function (req, res, next) {
    if (!ensureAdminRequest(req, res)) {
      return;
    }

    try {
      const { idUser } = req.params;
      const isNewRecord = idUser === 'new';
      const parsedUserId = Number(idUser);
      const userId = !idUser || isNewRecord || Number.isNaN(parsedUserId) ? null : parsedUserId;

      if (req.body.delete !== undefined && userId !== null) {
        await userRepository.deleteUser(userId);
        return res.redirect('/users');
      }

      if (req.body.submit !== undefined && idUser) {
        if (isNewRecord) {
          const hashedPassword = await bcrypt.hash(req.body.password, 10);
          await userRepository.createUser({
            name: req.body.name,
            email: req.body.email,
            passwordHash: hashedPassword,
            role: req.body.role
          });
        } else if (userId !== null) {
          const updatePayload = {
            name: req.body.name,
            email: req.body.email,
            role: req.body.role
          };

          if (req.body.password !== '') {
            updatePayload.passwordHash = await bcrypt.hash(req.body.password, 10);
          }

          await userRepository.updateUser(userId, updatePayload);
        }

        return res.redirect('/users');
      }

      if (idUser) {
        if (isNewRecord) {
          return res.render('edit_user', {
            title: 'Nodervisor - Edit User',
            user: null,
            session: req.session
          });
        }

        if (userId === null) {
          return res.redirect('/users');
        }

        const user = await userRepository.getUserById(userId);

        if (!user) {
          return res.redirect('/users');
        }

        return res.render('edit_user', {
          title: 'Nodervisor - Edit User',
          user,
          session: req.session
        });
      }

      const users = await userRepository.listUsers();

      return res.render('users', {
        title: 'Nodervisor - Users',
        users,
        session: req.session
      });
    } catch (err) {
      return next(err);
    }
  };
}
