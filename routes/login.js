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
  const {
    data: { users: userRepository }
  } = context;
  return async function (req, res, next) {
    try {
      if (isSessionAuthenticated(req.session)) {
        return res.redirect('/');
      }

      if (req.body.submit !== undefined) {
        const email = req.body.email;
        const userRecord = await userRepository.findByEmail(email);

        let error = 'Password failed';

        if (userRecord) {
          const passwordMatch = await bcrypt.compare(req.body.password, userRecord.passwordHash);
          if (passwordMatch) {
            const session = /** @type {RequestSession} */ (req.session);
            session.loggedIn = true;
            const { passwordHash, ...user } = userRecord;
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
