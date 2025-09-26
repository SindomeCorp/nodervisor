import { Router } from 'express';
import { z } from 'zod';

import { assertSessionRole } from '../../server/session.js';
import { ROLE_ADMIN, ROLE_MANAGER } from '../../shared/roles.js';
import { isSafeUrl, normalizeSafeUrl } from '../../shared/url.js';
import { validateRequest } from '../middleware/validation.js';
import { handleRouteError, sendError } from './utils.js';
import { MAX_NAME_LENGTH, MAX_URL_LENGTH } from '../../shared/validation.js';

/** @typedef {import('../../server/types.js').ServerContext} ServerContext */

export function createHostsApi(context) {
  const router = Router();
  const {
    data: { hosts: hostRepository },
    config
  } = context;

  router.get('/', async (req, res) => {
    try {
      assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
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
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
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
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
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
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
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
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
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
    name: requiredTrimmedString('Name', MAX_NAME_LENGTH),
    url: requiredHttpUrl('URL'),
    groupId: nullableNumber('groupId must be a number.').optional()
  })
  .transform((data) => ({
    name: data.name,
    url: normalizeSafeUrl(data.url) ?? data.url,
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

function requiredTrimmedString(field, maxLength) {
  return z.preprocess(
    (value) => (value === undefined ? value : String(value)),
    z
      .string({ required_error: `${field} is required.` })
      .trim()
      .min(1, `${field} is required.`)
      .max(maxLength, `${field} must be at most ${maxLength} characters long.`)
  );
}

function requiredHttpUrl(field) {
  const message = `${field} must be a valid http(s) URL.`;

  return z.preprocess(
    (value) => (value === undefined ? value : String(value)),
    z
      .string({ required_error: `${field} is required.` })
      .trim()
      .min(1, `${field} is required.`)
      .max(MAX_URL_LENGTH, `${field} must be at most ${MAX_URL_LENGTH} characters long.`)
      .url({ message })
      .refine((value) => isSafeUrl(value), { message })
  );
}
