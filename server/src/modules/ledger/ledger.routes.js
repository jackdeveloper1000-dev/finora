import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './ledger.controller.js';

const id = z.coerce.number().int().positive();

const documentParams = z.object({ id });
const caseParams = z.object({ caseId: id });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
  filter: z.enum(['all', 'review', 'reviewed', 'ignored']).default('all'),
  category: z.string().trim().max(40).optional(),
});

const router = Router();

router.use(authenticate);
router.post('/documents/:id/process', validate(documentParams, 'params'), controller.processStatement);
router.get('/cases/:caseId/transactions', validate(caseParams, 'params'), validate(listQuery, 'query'), controller.transactions);
router.get('/cases/:caseId/ledger', validate(caseParams, 'params'), controller.summary);

export default router;
