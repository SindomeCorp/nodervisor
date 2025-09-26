import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { ServiceError } from '../../services/errors.js';
import { EmailAlreadyExistsError } from '../../data/users.js';
import { ROLE_NONE } from '../../shared/roles.js';
import { checkPasswordAgainstPolicy } from '../../shared/passwordPolicy.js';
import { validateRequest } from '../middleware/validation.js';
import { normalizedEmailSchema, requiredTrimmedString } from './schemaHelpers.js';

/** @typedef {import('../../server/types.js').ServerContext} ServerContext */
/** @typedef {import('../../server/types.js').RequestSession} RequestSession */

export function createAuthApi(context) {
  const router = Router();
  const {
    config,
    data: { users: userRepository }
  } = context;
  const sessionCookieName = config?.session?.name ?? 'connect.sid';
  const sessionCookieConfig = config?.session?.cookie;
  const isRegistrationAllowed = () => Boolean(config?.auth?.allowSelfRegistration ?? false);

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json({ status: 'error', error: { message: 'Too many login attempts. Please try again later.' } });
    }
  });

  router.get('/session', (req, res) => {
    const csrfToken =
      typeof res.locals.csrfToken === 'string' && res.locals.csrfToken.length > 0
        ? res.locals.csrfToken
        : req.csrfToken();

    res.json({
      status: 'success',
      data: {
        user: req.session?.user ?? null,
        csrfToken,
        allowSelfRegistration: isRegistrationAllowed()
      }
    });
  });

  router.post(
    '/login',
    loginLimiter,
    validateRequest({ body: loginRequestSchema }),
    async (req, res) => {
      try {
        const { email, password } = req.validated.body;
        const userRecord = await userRepository.findByEmail(email);

        if (!userRecord) {
          res.status(401).json({ status: 'error', error: { message: 'Invalid email or password.' } });
          return;
        }

        const passwordMatch = await bcrypt.compare(password, userRecord.passwordHash);
        if (!passwordMatch) {
          res.status(401).json({ status: 'error', error: { message: 'Invalid email or password.' } });
          return;
        }

        await new Promise((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });

        const session = /** @type {RequestSession} */ (req.session);
        session.loggedIn = true;
        const { passwordHash: _passwordHash, ...user } = userRecord;
        session.user = user;

        res.json({ status: 'success', data: { user } });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  router.post('/logout', async (req, res, next) => {
    req.session?.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie(sessionCookieName, buildCookieOptions(sessionCookieConfig));
      res.json({ status: 'success', data: { user: null } });
    });
  });

  router.post(
    '/register',
    (req, res, next) => {
      if (!isRegistrationAllowed()) {
        res.status(403).json({ status: 'error', error: { message: 'Self-registration is disabled.' } });
        return;
      }
      next();
    },
    validateRequest({ body: registrationSchema }),
    async (req, res) => {
      try {
        const { name, email, password } = req.validated.body;
        const existing = await userRepository.findByEmail(email);
        if (existing) {
          res.status(409).json({ status: 'error', error: { message: 'An account with that email already exists.' } });
          return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const created = await userRepository.createUser({
          name,
          email,
          passwordHash,
          role: ROLE_NONE
        });

        if (!created) {
          throw new ServiceError('Failed to create account', 500);
        }

        await new Promise((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });

        const session = /** @type {RequestSession} */ (req.session);
        session.loggedIn = true;
        session.user = created;

        res.status(201).json({ status: 'success', data: { user: created } });
      } catch (err) {
        if (err instanceof EmailAlreadyExistsError || err?.name === 'EmailAlreadyExistsError') {
          res
            .status(409)
            .json({ status: 'error', error: { message: 'An account with that email already exists.' } });
          return;
        }

        handleError(res, err);
      }
    }
  );

  return router;
}

function buildCookieOptions(cookieConfig) {
  const { path = '/', domain, sameSite, secure, httpOnly } = cookieConfig ?? {};
  const options = { path };

  if (domain !== undefined) {
    options.domain = domain;
  }
  if (sameSite !== undefined) {
    options.sameSite = sameSite;
  }
  if (secure !== undefined) {
    options.secure = secure;
  }
  if (httpOnly !== undefined) {
    options.httpOnly = httpOnly;
  }

  return options;
}

function handleError(res, err) {
  if (err instanceof ServiceError) {
    res.status(err.statusCode ?? 500).json({ status: 'error', error: { message: err.message } });
    return;
  }

  res.status(500).json({ status: 'error', error: { message: 'Unexpected error' } });
}

const emailSchema = normalizedEmailSchema('Email');

const passwordSchema = z
  .preprocess((value) => (value === undefined ? value : String(value)), z.string({ required_error: 'Password is required.' }))
  .superRefine((value, ctx) => {
    if (value == null) {
      return;
    }
    const errors = checkPasswordAgainstPolicy(value);
    for (const message of errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

const loginPasswordSchema = z.preprocess(
  (value) => (value === undefined ? value : String(value)),
  z.string({ required_error: 'Password is required.' }).trim().min(1, 'Password is required.')
);

const loginRequestSchema = z.object({
  email: emailSchema.transform((value) => value.toLowerCase()),
  password: loginPasswordSchema
});

const registrationSchema = z.object({
  name: requiredTrimmedString('Name'),
  email: emailSchema.transform((value) => value.toLowerCase()),
  password: passwordSchema
});
