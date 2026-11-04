import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { QUESTIONS } from './eligibility.js';
import * as tax from './tax.service.js';

const caseParams = z.object({ caseId: z.coerce.number().int().positive() });
const answersBody = z.object({ answers: z.partialRecord(z.enum(QUESTIONS.map((q) => q.key)), z.enum(['yes', 'no'])) });
const regimeBody = z.object({ regime: z.enum(['old', 'new']) });

const router = Router();
router.use(authenticate);

router.get('/cases/:caseId/eligibility', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await tax.getEligibility(req.user.id, req.params.caseId));
}));

router.put('/cases/:caseId/eligibility', validate(caseParams, 'params'), validate(answersBody), asyncHandler(async (req, res) => {
  res.json(await tax.saveAnswers(req.user.id, req.params.caseId, req.body.answers, req.ip));
}));

router.get('/cases/:caseId/tax-calculation', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await tax.getCalculation(req.user.id, req.params.caseId));
}));

router.post('/cases/:caseId/tax-calculation', validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.status(201).json(await tax.calculateTax(req.user.id, req.params.caseId, req.ip));
}));

router.put('/cases/:caseId/tax-regime', validate(caseParams, 'params'), validate(regimeBody), asyncHandler(async (req, res) => {
  res.json(await tax.chooseRegime(req.user.id, req.params.caseId, req.body.regime, req.ip));
}));

export default router;
