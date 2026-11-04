import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './cases.controller.js';
import { caseIdSchema, createCaseSchema } from './cases.schema.js';

const router = Router();

router.use(authenticate);
router.get('/', controller.list);
router.post('/', validate(createCaseSchema), controller.create);
router.get('/years', controller.years);
router.get('/:id', validate(caseIdSchema, 'params'), controller.get);
router.delete('/:id', validate(caseIdSchema, 'params'), controller.remove);

export default router;
