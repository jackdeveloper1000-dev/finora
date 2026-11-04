import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as classification from './classification.service.js';

const id = z.coerce.number().int().positive();

const transactionParams = z.object({ id });
const caseParams = z.object({ caseId: id });
const updateBody = z
  .object({
    action: z.enum(['confirm', 'ignore', 'categorize', 'reset']),
    categoryCode: z.string().trim().min(1).max(40).optional(),
    applyToSimilar: z.boolean().optional(),
  })
  .refine((d) => d.action !== 'categorize' || d.categoryCode, { message: 'Choose a category', path: ['categoryCode'] });

const router = Router();
router.use(authenticate);

router.get('/categories', asyncHandler(async (_req, res) => res.json({ categories: await classification.listCategories() })));

router.get('/transactions/:id/similar', validate(transactionParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await classification.countSimilar(req.user.id, req.params.id));
}));

router.patch('/transactions/:id', validate(transactionParams, 'params'), validate(updateBody), asyncHandler(async (req, res) => {
  res.json(await classification.updateTransaction(req.user.id, req.params.id, req.body, req.ip));
}));

router.post('/cases/:caseId/transactions/confirm-high-confidence', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await classification.confirmHighConfidence(req.user.id, req.params.caseId, req.ip));
}));

export default router;
