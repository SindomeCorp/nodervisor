import { Router } from 'express';
import { z } from 'zod';

import { assertSessionAdmin } from '../../server/session.js';
import { validateRequest } from '../middleware/validation.js';
import { handleRouteError, sendError } from './utils.js';

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
      handleRouteError(res, err);
    }
  });

  router.post(
    '/',
    validateRequest({ body: hostPayloadSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const payload = req.validated.body;

        const created = await hostRepository.createHost(payload);
        await config.refreshHosts(context.db);
        res.status(201).json({ status: 'success', data: created });
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  router.get(
    '/:id',
    validateRequest({ params: hostIdParamsSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const { id } = req.validated.params;

        const host = await hostRepository.getHostById(id);
        if (!host) {
          sendError(res, 404, 'Host not found.');
          return;
        }

        res.json({ status: 'success', data: host });
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  router.put(
    '/:id',
    validateRequest({ params: hostIdParamsSchema, body: hostPayloadSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const { id } = req.validated.params;
        const payload = req.validated.body;

        const updated = await hostRepository.updateHost(id, payload);
        if (!updated) {
          sendError(res, 404, 'Host not found.');
          return;
        }

        await config.refreshHosts(context.db);
        res.json({ status: 'success', data: updated });
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  router.delete(
    '/:id',
    validateRequest({ params: hostIdParamsSchema }),
    async (req, res) => {
      try {
        assertSessionAdmin(req.session);
        const { id } = req.validated.params;

        const existing = await hostRepository.getHostById(id);
        if (!existing) {
          sendError(res, 404, 'Host not found.');
          return;
        }

        await hostRepository.deleteHost(id);
        await config.refreshHosts(context.db);
        res.status(204).send();
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  return router;
}

const hostPayloadSchema = z
  .object({
    name: requiredTrimmedString('Name'),
    url: requiredTrimmedString('URL'),
    groupId: nullableNumber('groupId must be a number.').optional()
  })
  .transform((data) => ({
    name: data.name,
    url: data.url,
    groupId: data.groupId ?? null
  }));

const hostIdParamsSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'Invalid host id.' })
    .refine((value) => Number.isFinite(value), 'Invalid host id.')
});

function nullableNumber(message) {
  return z
    .custom((value) => {
      if (value === '' || value === undefined || value === null) {
        return true;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed);
    }, { message })
    .transform((value) => {
      if (value === '' || value === undefined || value === null) {
        return null;
      }

      return Number(value);
    });
}

function requiredTrimmedString(field) {
  return z.preprocess(
    (value) => (value === undefined ? value : String(value)),
    z
      .string({ required_error: `${field} is required.` })
      .trim()
      .min(1, `${field} is required.`)
  );
}
