import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as reconciliation from './reconciliation.service.js';

const id = z.coerce.number().int().positive();
const caseParams = z.object({ caseId: id });
const itemParams = z.object({ id });
const resolveBody = z.object({
  action: z.enum(['resolve', 'escalate', 'reopen']),
  note: z.string().trim().max(255).optional(),
});

const router = Router();
router.use(authenticate);

router.get('/cases/:caseId/reconciliation', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await reconciliation.getReconciliation(req.user.id, req.params.caseId));
}));

router.patch('/reconciliation/:id', validate(itemParams, 'params'), validate(resolveBody), asyncHandler(async (req, res) => {
  await reconciliation.resolveItem(req.user.id, req.params.id, req.body, req.ip);
  res.status(204).end();
}));

export default router;
