import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as itr from './itr.service.js';

const caseParams = z.object({ caseId: z.coerce.number().int().positive() });
const approveBody = z.object({ confirmations: z.array(z.string().max(40)).max(10) });

const router = Router();
router.use(authenticate);

router.get('/cases/:caseId/itr', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await itr.getReturn(req.user.id, req.params.caseId));
}));

router.post('/cases/:caseId/itr/approve', validate(caseParams, 'params'), validate(approveBody), asyncHandler(async (req, res) => {
  res.json(await itr.approveReturn(req.user.id, req.params.caseId, req.body.confirmations, req.ip));
}));

router.get('/cases/:caseId/itr/export', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  const { filename, body } = await itr.exportReturn(req.user.id, req.params.caseId, req.ip);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.type('application/json').send(JSON.stringify(body, null, 2));
}));

export default router;
