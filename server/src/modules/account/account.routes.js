import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as account from './account.service.js';

const nameBody = z.object({ name: z.string().trim().min(2, 'Enter your full name').max(120) });
const prefsBody = z.object({ notifyProcessed: z.boolean().optional(), notifyReturns: z.boolean().optional() });
const passwordBody = z.object({ password: z.string().min(1, 'Enter your password').max(72) });

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => res.json({ account: await account.getAccount(req.user.id), preferences: await account.getPreferences(req.user.id) })));
router.put('/', validate(nameBody), asyncHandler(async (req, res) => res.json({ account: await account.updateAccount(req.user.id, req.body) })));
router.put('/preferences', validate(prefsBody), asyncHandler(async (req, res) => res.json({ preferences: await account.updatePreferences(req.user.id, req.body) })));

router.get('/export', asyncHandler(async (req, res) => {
  const data = await account.exportData(req.user.id, req.ip);
  res.setHeader('Content-Disposition', 'attachment; filename="finora-my-data.json"');
  res.setHeader('Cache-Control', 'private, no-store');
  res.type('application/json').send(JSON.stringify(data, null, 2));
}));

router.post('/clear-data', validate(passwordBody), asyncHandler(async (req, res) => {
  await account.clearData(req.user.id, req.body.password, req.ip);
  res.status(204).end();
}));

router.post('/delete', validate(passwordBody), asyncHandler(async (req, res) => {
  await account.deleteAccount(req.user.id, req.body.password);
  res.status(204).end();
}));

export default router;
