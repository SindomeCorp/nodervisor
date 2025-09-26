import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';

import { assertSessionAdmin } from '../../server/session.js';
import { EmailAlreadyExistsError } from '../../data/users.js';
import { ALL_ROLES } from '../../shared/roles.js';
import { checkPasswordAgainstPolicy } from '../../shared/passwordPolicy.js';
import { validateRequest } from '../middleware/validation.js';
import { handleRouteError, sendError } from './utils.js';
import { normalizedEmailSchema, requiredTrimmedString } from './schemaHelpers.js';

/** @typedef {import('../../server/types.js').ServerContext} ServerContext */

export function createUsersApi(context) {
  const router = Router();
  const {
    data: { users: userRepository }
  } = context;

  router.get('/', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const users = await userRepository.listUsers();
      res.json({ status: 'success', data: users });
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  router.post(
    '/',
    validateRequest({ body: userCreateSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const { name, email, role, password } = req.validated.body;

        const passwordHash = await bcrypt.hash(password, 10);
        const created = await userRepository.createUser({
          name,
          email,
          role,
          passwordHash
        });

        res.status(201).json({ status: 'success', data: created });
      } catch (err) {
        if (err instanceof EmailAlreadyExistsError) {
          sendError(res, 409, 'Email already exists.');
          return;
        }

        handleRouteError(res, err);
      }
    }
  );

  router.get(
    '/:id',
    validateRequest({ params: userIdParamsSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const { id } = req.validated.params;

        const user = await userRepository.getUserById(id);
        if (!user) {
          sendError(res, 404, 'User not found.');
          return;
        }

        res.json({ status: 'success', data: user });
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  router.put(
    '/:id',
    validateRequest({ params: userIdParamsSchema, body: userUpdateSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const { id } = req.validated.params;
        const { password, ...userData } = req.validated.body;
        const updatePayload = { ...userData };

        if (password) {
          updatePayload.passwordHash = await bcrypt.hash(password, 10);
        }

        const updated = await userRepository.updateUser(id, updatePayload);
        if (!updated) {
          sendError(res, 404, 'User not found.');
          return;
        }

        if (req.session?.user && req.session.user.id === updated.id) {
          req.session.user = { ...req.session.user, ...updated };
        }

        res.json({ status: 'success', data: updated });
      } catch (err) {
        if (err instanceof EmailAlreadyExistsError) {
          sendError(res, 409, 'Email already exists.');
          return;
        }

        handleRouteError(res, err);
      }
    }
  );

  router.delete(
    '/:id',
    validateRequest({ params: userIdParamsSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const { id } = req.validated.params;

        const existing = await userRepository.getUserById(id);
        if (!existing) {
          sendError(res, 404, 'User not found.');
          return;
        }

        await userRepository.deleteUser(id);
        res.status(204).send();
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  return router;
}

const roleSchema = requiredTrimmedString('Role', { max: 32 }).refine((value) => ALL_ROLES.includes(value), 'Invalid role.');

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

const userCreateSchema = z.object({
  name: requiredTrimmedString('Name', { max: 32 }),
  email: emailSchema.transform((value) => value.toLowerCase()),
  role: roleSchema,
  password: passwordSchema
});

const userUpdateSchema = z.object({
  name: requiredTrimmedString('Name', { max: 32 }),
  email: emailSchema.transform((value) => value.toLowerCase()),
  role: roleSchema,
  password: passwordSchema.optional()
});

const userIdParamsSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'Invalid user id.' })
    .refine((value) => Number.isFinite(value), 'Invalid user id.')
});
