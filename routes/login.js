/*
 * GET/POST login page
 */

import bcrypt from 'bcrypt';

import { isSessionAuthenticated } from '../server/session.js';

/** @typedef {import('../server/types.js').ServerContext} ServerContext */
/** @typedef {import('../server/types.js').RequestSession} RequestSession */

/**
 * @param {ServerContext} context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function login(context) {
  const { db } = context;
  return async function (req, res, next) {
    try {
      if (isSessionAuthenticated(req.session)) {
        return res.redirect('/');
      }

      if (req.body.submit !== undefined) {
        const email = req.body.email;
        const users = await db('users').where('Email', email);

        let error = 'Password failed';
        const user = users[0];

        if (user) {
          const passwordMatch = await bcrypt.compare(req.body.password, user.Password);
          if (passwordMatch) {
            const session = /** @type {RequestSession} */ (req.session);
            session.loggedIn = true;
            session.user = user;
            return res.redirect('/');
          }
        } else {
          error = 'Email not found';
        }

        const session = /** @type {RequestSession} */ (req.session);
        session.loggedIn = false;
        session.user = null;
        return res.render('login', {
          title: 'Nodervisor - Login',
          error
        });
      }

      return res.render('login', {
        title: 'Nodervisor - Login',
        session: req.session
      });
    } catch (err) {
      return next(err);
    }
  };
}
