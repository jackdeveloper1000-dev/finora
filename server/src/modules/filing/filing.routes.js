import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as filing from './filing.service.js';
import * as submission from './submission.service.js';

const filedBody = z.object({
  ackNumber: z.string().trim().regex(/^[0-9]{10,20}$/, 'Enter the acknowledgement number from the portal (digits only)'),
  filedOn: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Enter the filing date').refine((d) => !Number.isNaN(Date.parse(d)) && new Date(d) <= new Date(), 'The filing date cannot be in the future'),
  eVerified: z.boolean().default(false),
});

const caseParams = z.object({ caseId: z.coerce.number().int().positive() });

const router = Router();
router.use(authenticate);

router.get('/cases/:caseId/filing', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await filing.getFiling(req.user.id, req.params.caseId));
}));

router.get('/cases/:caseId/filing-submission', requireRole('customer'), validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await submission.getSubmission(req.user.id, req.params.caseId));
}));

router.post('/cases/:caseId/filing-submission', requireRole('customer'), validate(caseParams, 'params'), validate(filedBody), asyncHandler(async (req, res) => {
  res.status(201).json(await submission.recordFiling(req.user.id, req.params.caseId, req.body, req.ip));
}));

export default router;
