import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadSingle } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './documents.controller.js';
import { caseParamsSchema, documentParamsSchema, fileTokenSchema, uploadBodySchema } from './documents.schema.js';

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.isProd ? 40 : 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please wait a few minutes.' } },
});

// Token-authenticated (short-lived signed link) so it can open in a new tab.
router.get('/documents/file', validate(fileTokenSchema, 'query'), controller.file);

router.use(authenticate);
router.get('/cases/:caseId/documents', validate(caseParamsSchema, 'params'), controller.list);
router.post(
  '/cases/:caseId/documents',
  uploadLimiter,
  validate(caseParamsSchema, 'params'),
  uploadSingle,
  validate(uploadBodySchema),
  controller.upload,
);
router.post('/documents/:id/link', validate(documentParamsSchema, 'params'), controller.link);
router.delete('/documents/:id', validate(documentParamsSchema, 'params'), controller.remove);

export default router;
