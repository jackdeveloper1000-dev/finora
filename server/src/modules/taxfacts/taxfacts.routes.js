import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { FACT_SOURCES } from './definitions.js';
import * as taxFacts from './taxfacts.service.js';

const MAX_AMOUNT = 100_000_000_000;

const params = z.object({
  caseId: z.coerce.number().int().positive(),
  source: z.enum(Object.keys(FACT_SOURCES)).optional(),
});

const amount = z.union([z.number().min(0, 'Must be 0 or more').max(MAX_AMOUNT, 'Amount is too large'), z.null()]);
const saveBody = z.object({
  documentId: z.number().int().positive().nullable().optional(),
  values: z.record(z.string(), amount),
});

const router = Router();
router.use(authenticate);

router.get('/cases/:caseId/tax-facts', validate(params, 'params'), asyncHandler(async (req, res) => {
  res.json(await taxFacts.getTaxFacts(req.user.id, req.params.caseId));
}));

router.put('/cases/:caseId/tax-facts/:source', validate(params, 'params'), validate(saveBody), asyncHandler(async (req, res) => {
  res.json(await taxFacts.saveTaxFacts(req.user.id, req.params.caseId, req.params.source, req.body, req.ip));
}));

export default router;
