import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { requireExpert } from '../../middleware/expertGuard.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as review from './review.service.js';

const caseParams = z.object({ caseId: z.coerce.number().int().positive() });
const reviewParams = z.object({ reviewId: z.coerce.number().int().positive() });
const queueQuery = z.object({ scope: z.enum(['open', 'mine', 'done']).default('open') });
const text = (max) => z.string().trim().min(1, 'Required').max(max);
const requestBody = z.object({ note: z.string().trim().max(500).optional() });
const messageBody = z.object({ body: text(2000) });
const decisionBody = z.object({ decision: z.enum(['approved', 'changes_needed']), message: z.string().trim().max(2000).optional() });

export const customerRouter = Router();
const customerOnly = [authenticate, requireRole('customer')];
customerRouter.get('/cases/:caseId/review', ...customerOnly, validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await review.getCaseReview(req.user.id, req.params.caseId));
}));
customerRouter.post('/cases/:caseId/review', ...customerOnly, validate(caseParams, 'params'), validate(requestBody), asyncHandler(async (req, res) => {
  res.status(201).json(await review.requestReview(req.user.id, req.params.caseId, req.body.note, req.ip));
}));
customerRouter.post('/cases/:caseId/review/messages', ...customerOnly, validate(caseParams, 'params'), validate(messageBody), asyncHandler(async (req, res) => {
  res.status(201).json(await review.customerReply(req.user, req.params.caseId, req.body.body));
}));
customerRouter.post('/cases/:caseId/review/cancel', ...customerOnly, validate(caseParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await review.cancelReview(req.user.id, req.params.caseId, req.ip));
}));

export const expertRouter = Router();
expertRouter.use(authenticate, ...requireExpert);
expertRouter.get('/reviews', validate(queueQuery, 'query'), asyncHandler(async (req, res) => {
  res.json({ reviews: await review.listQueue(req.user, req.query.scope) });
}));
expertRouter.get('/reviews/:reviewId', validate(reviewParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await review.getExpertReview(req.user, req.params.reviewId, req.ip));
}));
expertRouter.post('/reviews/:reviewId/claim', validate(reviewParams, 'params'), asyncHandler(async (req, res) => {
  res.json(await review.claimReview(req.user, req.params.reviewId, req.ip));
}));
expertRouter.post('/reviews/:reviewId/messages', validate(reviewParams, 'params'), validate(messageBody), asyncHandler(async (req, res) => {
  res.status(201).json(await review.expertMessage(req.user, req.params.reviewId, req.body.body, req.ip));
}));
expertRouter.post('/reviews/:reviewId/decision', validate(reviewParams, 'params'), validate(decisionBody), asyncHandler(async (req, res) => {
  res.json(await review.decide(req.user, req.params.reviewId, req.body, req.ip));
}));
