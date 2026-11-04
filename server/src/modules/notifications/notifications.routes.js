import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as notifications from './notifications.service.js';

const idParams = z.object({ id: z.coerce.number().int().positive() });

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => res.json(await notifications.listNotifications(req.user.id))));
router.get('/unread-count', asyncHandler(async (req, res) => res.json(await notifications.unreadCount(req.user.id))));
router.post('/read-all', asyncHandler(async (req, res) => {
  await notifications.markAllRead(req.user.id);
  res.status(204).end();
}));
router.patch('/:id/read', validate(idParams, 'params'), asyncHandler(async (req, res) => {
  await notifications.markRead(req.user.id, req.params.id);
  res.status(204).end();
}));

export default router;
