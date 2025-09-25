import { Router } from 'express';
import bcrypt from 'bcrypt';

import { ServiceError } from '../../services/errors.js';

/** @typedef {import('../../server/types.js').ServerContext} ServerContext */
/** @typedef {import('../../server/types.js').RequestSession} RequestSession */

export function createAuthApi(context) {
  const router = Router();
  const {
    data: { users: userRepository }
  } = context;

  router.get('/session', (req, res) => {
    res.json({
      status: 'success',
      data: {
        user: req.session?.user ?? null
      }
    });
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        res.status(400).json({ status: 'error', error: { message: 'Email and password are required.' } });
        return;
      }

      const normalizedEmail = String(email).trim();
      const userRecord = await userRepository.findByEmail(normalizedEmail);

      if (!userRecord) {
        res.status(401).json({ status: 'error', error: { message: 'Invalid email or password.' } });
        return;
      }

      const passwordMatch = await bcrypt.compare(String(password), userRecord.passwordHash);
      if (!passwordMatch) {
        res.status(401).json({ status: 'error', error: { message: 'Invalid email or password.' } });
        return;
      }

      const session = /** @type {RequestSession} */ (req.session);
      session.loggedIn = true;
      const { passwordHash: _passwordHash, ...user } = userRecord;
      session.user = user;

      res.json({ status: 'success', data: { user } });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post('/logout', async (req, res, next) => {
    req.session?.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie('connect.sid');
      res.json({ status: 'success', data: { user: null } });
    });
  });

  router.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body ?? {};
      if (!name || !email || !password) {
        res.status(400).json({ status: 'error', error: { message: 'Name, email, and password are required.' } });
        return;
      }

      const normalizedEmail = String(email).trim();
      const existing = await userRepository.findByEmail(normalizedEmail);
      if (existing) {
        res.status(409).json({ status: 'error', error: { message: 'An account with that email already exists.' } });
        return;
      }

      const passwordHash = await bcrypt.hash(String(password), 10);
      const created = await userRepository.createUser({
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'User'
      });

      if (!created) {
        throw new ServiceError('Failed to create account', 500);
      }

      const session = /** @type {RequestSession} */ (req.session);
      session.loggedIn = true;
      session.user = created;

      res.status(201).json({ status: 'success', data: { user: created } });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}

function handleError(res, err) {
  if (err instanceof ServiceError) {
    res.status(err.statusCode ?? 500).json({ status: 'error', error: { message: err.message } });
    return;
  }

  res.status(500).json({ status: 'error', error: { message: 'Unexpected error' } });
}
