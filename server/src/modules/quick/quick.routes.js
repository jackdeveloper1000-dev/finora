import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { quickPrepare } from './quick.service.js';

const router = Router();

router.post(
  '/cases/:caseId/quick-prepare',
  authenticate,
  requireRole('customer'),
  validate(z.object({ caseId: z.coerce.number().int().positive() }), 'params'),
  asyncHandler(async (req, res) => {
    res.json(await quickPrepare(req.user.id, req.params.caseId, req.ip));
  }),
);

export default router;
