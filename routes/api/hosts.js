import { Router } from 'express';

import { assertSessionAdmin } from '../../server/session.js';
import { ServiceError } from '../../services/supervisordService.js';

/** @typedef {import('../../server/types.js').ServerContext} ServerContext */

export function createHostsApi(context) {
  const router = Router();
  const {
    data: { hosts: hostRepository },
    config
  } = context;

  router.get('/', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const hosts = await hostRepository.listHosts();
      res.json({ status: 'success', data: hosts });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post('/', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const { name, url, groupId = null } = req.body ?? {};

      if (!name || !url) {
        res.status(400).json({ status: 'error', error: { message: 'Name and URL are required.' } });
        return;
      }

      const payload = {
        name: String(name).trim(),
        url: String(url).trim(),
        groupId: parseNullableNumber(groupId)
      };

      const created = await hostRepository.createHost(payload);
      await config.refreshHosts(context.db);
      res.status(201).json({ status: 'success', data: created });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ status: 'error', error: { message: 'Invalid host id.' } });
        return;
      }

      const host = await hostRepository.getHostById(id);
      if (!host) {
        res.status(404).json({ status: 'error', error: { message: 'Host not found.' } });
        return;
      }

      res.json({ status: 'success', data: host });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ status: 'error', error: { message: 'Invalid host id.' } });
        return;
      }

      const { name, url, groupId = null } = req.body ?? {};
      if (!name || !url) {
        res.status(400).json({ status: 'error', error: { message: 'Name and URL are required.' } });
        return;
      }

      const payload = {
        name: String(name).trim(),
        url: String(url).trim(),
        groupId: parseNullableNumber(groupId)
      };

      const updated = await hostRepository.updateHost(id, payload);
      if (!updated) {
        res.status(404).json({ status: 'error', error: { message: 'Host not found.' } });
        return;
      }

      await config.refreshHosts(context.db);
      res.json({ status: 'success', data: updated });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      assertSessionAdmin(req.session);
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ status: 'error', error: { message: 'Invalid host id.' } });
        return;
      }

      const existing = await hostRepository.getHostById(id);
      if (!existing) {
        res.status(404).json({ status: 'error', error: { message: 'Host not found.' } });
        return;
      }

      await hostRepository.deleteHost(id);
      await config.refreshHosts(context.db);
      res.status(204).send();
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function handleError(res, err) {
  if (err instanceof ServiceError) {
    const payload = { status: 'error', error: { message: err.message } };
    if (err.details) {
      payload.error.details = err.details;
    }
    res.status(err.statusCode ?? 500).json(payload);
    return;
  }

  res.status(500).json({ status: 'error', error: { message: 'Unexpected error' } });
}
