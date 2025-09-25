import { Router } from 'express';
import bcrypt from 'bcrypt';

import { assertSessionAdmin } from '../../server/session.js';
import { ServiceError } from '../../services/supervisordService.js';

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
      handleError(res, err);
    }
  });

  router.post('/', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const { name, email, role, password } = req.body ?? {};
      const validationError = validateUserInput({ name, email, role, passwordRequired: true, password });
      if (validationError) {
        res.status(400).json({ status: 'error', error: { message: validationError } });
        return;
      }

      const passwordHash = await bcrypt.hash(String(password), 10);
      const created = await userRepository.createUser({
        name: String(name).trim(),
        email: String(email).trim(),
        role: String(role).trim(),
        passwordHash
      });

      res.status(201).json({ status: 'success', data: created });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const id = parseId(req.params.id);
      if (id == null) {
        res.status(400).json({ status: 'error', error: { message: 'Invalid user id.' } });
        return;
      }

      const user = await userRepository.getUserById(id);
      if (!user) {
        res.status(404).json({ status: 'error', error: { message: 'User not found.' } });
        return;
      }

      res.json({ status: 'success', data: user });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const id = parseId(req.params.id);
      if (id == null) {
        res.status(400).json({ status: 'error', error: { message: 'Invalid user id.' } });
        return;
      }

      const { name, email, role, password } = req.body ?? {};
      const validationError = validateUserInput({ name, email, role, password });
      if (validationError) {
        res.status(400).json({ status: 'error', error: { message: validationError } });
        return;
      }

      const updatePayload = {
        name: String(name).trim(),
        email: String(email).trim(),
        role: String(role).trim(),
        passwordHash: password ? await bcrypt.hash(String(password), 10) : undefined
      };

      const updated = await userRepository.updateUser(id, updatePayload);
      if (!updated) {
        res.status(404).json({ status: 'error', error: { message: 'User not found.' } });
        return;
      }

      res.json({ status: 'success', data: updated });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const id = parseId(req.params.id);
      if (id == null) {
        res.status(400).json({ status: 'error', error: { message: 'Invalid user id.' } });
        return;
      }

      const existing = await userRepository.getUserById(id);
      if (!existing) {
        res.status(404).json({ status: 'error', error: { message: 'User not found.' } });
        return;
      }

      await userRepository.deleteUser(id);
      res.status(204).send();
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}

function parseId(raw) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateUserInput({ name, email, role, passwordRequired = false, password }) {
  if (!name) {
    return 'Name is required.';
  }

  if (!email) {
    return 'Email is required.';
  }

  if (!role) {
    return 'Role is required.';
  }

  if (passwordRequired && !password) {
    return 'Password is required.';
  }

  return null;
}

function handleError(res, err) {
  if (err instanceof ServiceError) {
    res.status(err.statusCode ?? 500).json({ status: 'error', error: { message: err.message } });
    return;
  }

  res.status(500).json({ status: 'error', error: { message: 'Unexpected error' } });
}
