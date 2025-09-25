import { Router } from 'express';

import { assertSessionAdmin } from '../../server/session.js';
import { ServiceError } from '../../services/errors.js';

/** @typedef {import('../../server/types.js').ServerContext} ServerContext */

export function createGroupsApi(context) {
  const router = Router();
  const {
    data: { groups: groupRepository }
  } = context;

  router.get('/', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const groups = await groupRepository.listGroups();
      res.json({ status: 'success', data: groups });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post('/', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const { name } = req.body ?? {};
      if (!name) {
        res.status(400).json({ status: 'error', error: { message: 'Name is required.' } });
        return;
      }

      const created = await groupRepository.createGroup({ name: String(name).trim() });
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
        res.status(400).json({ status: 'error', error: { message: 'Invalid group id.' } });
        return;
      }

      const group = await groupRepository.getGroupById(id);
      if (!group) {
        res.status(404).json({ status: 'error', error: { message: 'Group not found.' } });
        return;
      }

      res.json({ status: 'success', data: group });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const id = parseId(req.params.id);
      if (id == null) {
        res.status(400).json({ status: 'error', error: { message: 'Invalid group id.' } });
        return;
      }

      const { name } = req.body ?? {};
      if (!name) {
        res.status(400).json({ status: 'error', error: { message: 'Name is required.' } });
        return;
      }

      const updated = await groupRepository.updateGroup(id, { name: String(name).trim() });
      if (!updated) {
        res.status(404).json({ status: 'error', error: { message: 'Group not found.' } });
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
        res.status(400).json({ status: 'error', error: { message: 'Invalid group id.' } });
        return;
      }

      const existing = await groupRepository.getGroupById(id);
      if (!existing) {
        res.status(404).json({ status: 'error', error: { message: 'Group not found.' } });
        return;
      }

      await groupRepository.deleteGroup(id);
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

function handleError(res, err) {
  if (err instanceof ServiceError) {
    res.status(err.statusCode ?? 500).json({ status: 'error', error: { message: err.message } });
    return;
  }

  res.status(500).json({ status: 'error', error: { message: 'Unexpected error' } });
}
