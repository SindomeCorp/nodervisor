/*
 * GET/POST login page
 */

import bcrypt from 'bcrypt';
import escapeHtml from 'escape-html';

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
            const { passwordHash: _passwordHash, ...user } = userRecord;
            session.user = user;
            return res.redirect('/');
          }
        } else {
          error = 'Email not found';
        }

        const session = /** @type {RequestSession} */ (req.session);
        session.loggedIn = false;
        session.user = null;
        return res
          .type('html')
          .send(
            renderLoginPage({
              title: 'Nodervisor - Login',
              error
            })
          );
      }

      return res
        .type('html')
        .send(
          renderLoginPage({
            title: 'Nodervisor - Login'
          })
        );
    } catch (err) {
      return next(err);
    }
  };
}

function renderLoginPage({ title, error }) {
  const message = error ? `<div class="alert alert-danger" role="alert">${escapeHtml(error)}</div>` : '';

  return `<!DOCTYPE html>
<html class="no-js">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <title>${escapeHtml(title ?? 'Nodervisor - Login')}</title>
    <meta name="viewport" content="initial-scale=0.5, width=device-width">
    <link rel="stylesheet" href="/css/bootstrap.min.css">
    <link rel="stylesheet" href="/css/bootstrap-responsive.min.css">
    <link rel="stylesheet" href="/css/normalize.min.css">
    <link rel="stylesheet" href="/css/main.css">
    <link rel="stylesheet" href="/css/font-awesome.min.css">
  </head>
  <body>
    <div class="header-container">
      <header class="header-wrapper clearfix">
        <h1 class="title"><a href="/" style="text-decoration: none; color: white;">Nodervisor</a></h1>
      </header>
    </div>
    <div class="container" style="max-width: 480px; margin-top: 40px;">
      <div class="well">
        <h2>Sign in</h2>
        ${message}
        <form method="post" action="/login">
          <div class="control-group">
            <label class="control-label" for="email">Email</label>
            <div class="controls">
              <input type="email" class="input-xlarge" id="email" name="email" required />
            </div>
          </div>
          <div class="control-group">
            <label class="control-label" for="password">Password</label>
            <div class="controls">
              <input type="password" class="input-xlarge" id="password" name="password" required />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" name="submit" value="1" class="btn btn-primary">Login</button>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>`;
}
