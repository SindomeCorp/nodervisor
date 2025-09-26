import { Router } from 'express';
import { z } from 'zod';

import { assertSessionRole } from '../../server/session.js';
import { ROLE_ADMIN, ROLE_MANAGER } from '../../shared/roles.js';
import { validateRequest } from '../middleware/validation.js';
import { handleRouteError, sendError } from './utils.js';

/** @typedef {import('../../server/types.js').ServerContext} ServerContext */

export function createGroupsApi(context) {
  const router = Router();
  const {
    data: { groups: groupRepository },
    config,
    db
  } = context;

  router.get('/', async (req, res) => {
    try {
      assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
      const groups = await groupRepository.listGroups();
      res.json({ status: 'success', data: groups });
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  router.post(
    '/',
    validateRequest({ body: groupPayloadSchema }),
    async (req, res) => {
      try {
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
        const payload = req.validated.body;

        const created = await groupRepository.createGroup(payload);
        res.status(201).json({ status: 'success', data: created });
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  router.get(
    '/:id',
    validateRequest({ params: groupIdParamsSchema }),
    async (req, res) => {
      try {
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
        const { id } = req.validated.params;

        const group = await groupRepository.getGroupById(id);
        if (!group) {
          sendError(res, 404, 'Group not found.');
          return;
        }

        res.json({ status: 'success', data: group });
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  router.put(
    '/:id',
    validateRequest({ params: groupIdParamsSchema, body: groupPayloadSchema }),
    async (req, res) => {
      try {
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
        const { id } = req.validated.params;
        const payload = req.validated.body;

        const updated = await groupRepository.updateGroup(id, payload);
        if (!updated) {
          sendError(res, 404, 'Group not found.');
          return;
        }

        await config.refreshHosts(db);
        res.json({ status: 'success', data: updated });
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  router.delete(
    '/:id',
    validateRequest({ params: groupIdParamsSchema }),
    async (req, res) => {
      try {
        assertSessionRole(req.session, [ROLE_ADMIN, ROLE_MANAGER]);
        const { id } = req.validated.params;

        const existing = await groupRepository.getGroupById(id);
        if (!existing) {
          sendError(res, 404, 'Group not found.');
          return;
        }

        await groupRepository.deleteGroup(id);
        await config.refreshHosts(db);
        res.status(204).send();
      } catch (err) {
        handleRouteError(res, err);
      }
    }
  );

  return router;
}

const groupPayloadSchema = z.object({
  name: requiredTrimmedString('Name')
});

const groupIdParamsSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'Invalid group id.' })
    .refine((value) => Number.isFinite(value), 'Invalid group id.')
});

function requiredTrimmedString(field) {
  return z.preprocess(
    (value) => (value === undefined ? value : String(value)),
    z
      .string({ required_error: `${field} is required.` })
      .trim()
      .min(1, `${field} is required.`)
  );
}
